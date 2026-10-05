import { engine } from "../search/engine";
import { SECTION_BY_KEY, SECTIONS, sectionFor } from "../sections";
import type { Book, ChatRequest, ChatResponse, Lang, ParsedIntent, SearchHit } from "../types";
import { getLLM, parseJSON, type LLMProvider } from "./providers";
import { ruleParse } from "./nlu";

/**
 * The Librarian Agent:
 *   1. understand  → ParsedIntent (LLM JSON mode, rule fallback)
 *   2. decide      → chat / clarify / recommend a list / physically fetch one book
 *   3. respond     → grounded, friendly reply in the user's language (+ follow-up chips)
 *
 * The librarian only walks to the shelves when the user asks for a specific
 * book (or picks one from a list). Vague requests get a friendly question
 * about taste and reading style; "suggest some books" gets a list.
 */

const SECTION_LIST = SECTIONS.map((s) => `${s.key} (#${s.id} ${s.name.en})`).join(", ");

const INTENT_SYSTEM = `You are the query-understanding module of a friendly AI librarian in a virtual 3D library.
Classify the user's latest message. The user may write in English, Hindi (Devanagari) or Hinglish.
Return JSON: {
 "intent": "greeting|smalltalk|general_question|clarify|recommend_list|find_book|book_question|navigate_section|thanks|goodbye",
 "language": "en|hi"  (language the user wrote in; Hinglish counts as hi),
 "query": "concise ENGLISH semantic search query capturing topic, mood, themes, setting (omit author names); for a named title, the title",
 "filters": { "author"?: string, "genre"?: one of section keys, "language"?: "en|hi" only if the user explicitly wants books in that language },
 "bestsellers"?: true if they want popular / bestselling / must-read books,
 "reader"?: "casual|avid|student|young" if they describe what kind of reader they are,
 "sectionKey"?: section key for navigate_section
}
Section keys: ${SECTION_LIST}.
Decision rules (important):
- find_book ONLY when the user asks for one specific book or title, or explicitly asks you to get/bring/show them a book matching clear criteria ("I want a funny space survival novel", "get me Dune").
- recommend_list when they ask for suggestions / recommendations / "some books" / bestsellers and give at least some taste (genre, topic, mood, author or reader type), or when they answer your earlier question about their taste.
- clarify when they ask for suggestions without any criteria ("can you suggest me some books?", "what should I read?").
- general_question for anything that is not a request for books (facts, opinions, life questions, questions about authors or literature in general).
- smalltalk for chit-chat about you or how they are.
- book_question when they ask about the book currently being shown.`;

function persona(name: string, gender: "male" | "female", lang: Lang) {
  return `You are ${name}, a warm, witty and genuinely friendly ${gender} librarian in Arcanum, a magical infinite 3D library where every book ever written has a shelf.
You love chatting about books and life; you are curious about the person you're talking to.
Speak naturally (2-4 short sentences — this is spoken aloud). No markdown, no bullet lists, no emojis.
Reply in ${lang === "hi" ? `natural conversational Hindi (Devanagari), using ${gender === "male" ? "masculine" : "feminine"} first-person verb forms` : "English"}.
Never invent facts about a book beyond the metadata you're given; if unsure, say so gently.`;
}

type Pair = { en: string; hi: string };
const pick = (p: Pair, lang: Lang) => p[lang];

const CHIPS = {
  start: { en: ["Suggest me some books", "Show me bestsellers", "I'm a casual reader"], hi: ["कुछ अच्छी किताबें सुझाओ", "बेस्टसेलर दिखाओ", "मैं कभी-कभी पढ़ता हूँ"] },
  clarify: {
    en: ["Thrillers & mystery", "Romance", "Fantasy & sci-fi", "Self-improvement", "History & science", "Just show me bestsellers"],
    hi: ["रहस्य और थ्रिलर", "प्रेम कहानियाँ", "फैंटेसी और विज्ञान कथा", "आत्म-विकास", "इतिहास और विज्ञान", "बस बेस्टसेलर दिखाओ"],
  },
  list: { en: ["Something shorter", "I love long, deep reads", "Show me bestsellers"], hi: ["कुछ छोटी किताबें", "मुझे लंबी, गहरी किताबें पसंद हैं", "बेस्टसेलर दिखाओ"] },
  found: { en: ["Tell me about this book", "Find similar books", "Suggest me something different"], hi: ["इस किताब के बारे में बताओ", "ऐसी और किताबें", "कुछ अलग सुझाओ"] },
};

const T = {
  greet: (n: string): Pair => ({
    en: `Hello again! It's lovely to see you. What are you in the mood for today — or shall I suggest a few favourites?`,
    hi: `फिर से नमस्ते! आपसे मिलकर अच्छा लगा। आज क्या पढ़ने का मन है — या मैं कुछ पसंदीदा किताबें सुझाऊँ?`,
  }),
  thanks: { en: "My pleasure — truly! Is there anything else you'd like to explore?", hi: "मेरी खुशी है! क्या आप कुछ और देखना चाहेंगे?" },
  bye: { en: "Happy reading! Come back any time — the shelves will be waiting for you.", hi: "पढ़ने का आनंद लीजिए! जब चाहें लौट आइए — किताबें आपका इंतज़ार करेंगी।" },
  clarify: {
    en: "I'd love to! To pick the right ones, tell me a little about you — what do you enjoy: thrillers, romance, fantasy, self-growth, history? And are you more of a quick, easy reader or do you love long, deep books? Or I can simply show you some all-time bestsellers.",
    hi: "ज़रूर! सही किताबें चुनने के लिए अपने बारे में थोड़ा बताइए — आपको क्या पसंद है: थ्रिलर, प्रेम कहानियाँ, फैंटेसी, आत्म-विकास या इतिहास? और आप हल्की-फुल्की जल्दी पढ़ी जाने वाली किताबें पसंद करते हैं या लंबी, गहरी किताबें? या मैं आपको कुछ सदाबहार बेस्टसेलर दिखा दूँ।",
  },
  none: { en: "Hmm, nothing on the shelves matches that yet. Could you describe it another way — a theme, a mood or an author?", hi: "हम्म, अभी इसका कोई मेल नहीं मिला। क्या आप इसे किसी और तरह बता सकते हैं — कोई विषय, मूड या लेखक?" },
};

function smalltalkReply(msg: string, name: string, lang: Lang): string {
  const m = msg.toLowerCase();
  if (/how are you|kaise ho|kaisi ho|कैसे हो|कैसी हो|aap kaise/.test(m))
    return pick({ en: "I'm wonderful, thank you for asking — it's hard to be anything else surrounded by this many stories! How's your day going?", hi: "मैं बहुत अच्छी हूँ, पूछने के लिए शुक्रिया — इतनी कहानियों के बीच कोई उदास कैसे रह सकता है! आपका दिन कैसा जा रहा है?" }, lang);
  if (/who are you|your name|aap kaun|tum kaun|आप कौन|आपका नाम/.test(m))
    return pick({ en: `I'm ${name}, the librarian of Arcanum. I know my way around every shelf here, and I'm always happy to chat — about books or anything else.`, hi: `मैं ${name} हूँ, Arcanum की लाइब्रेरियन। मुझे यहाँ की हर शेल्फ़ का रास्ता पता है, और मुझे बातें करना बहुत पसंद है — किताबों के बारे में या किसी और चीज़ के बारे में।` }, lang);
  return pick({ en: "I'm all ears! Tell me a bit about yourself — what do you like to read, or what have you enjoyed lately?", hi: "मैं सुन रही हूँ! अपने बारे में थोड़ा बताइए — आपको क्या पढ़ना पसंद है, या हाल में क्या अच्छा लगा?" }, lang);
}

function sectionName(id: number, lang: Lang) {
  return sectionFor(id).name[lang];
}

const titleList = (hits: SearchHit[], lang: Lang) => {
  const parts = hits.slice(0, 3).map((h) => (lang === "hi" ? `"${h.book.title}" (${h.book.authors[0]})` : `"${h.book.title}" by ${h.book.authors[0]}`));
  if (parts.length < 2) return parts.join("");
  return parts.slice(0, -1).join(", ") + (lang === "hi" ? " और " : " and ") + parts[parts.length - 1];
};

function templateList(hits: SearchHit[], lang: Lang, bestsellers: boolean, reader?: string): string {
  const list = titleList(hits, lang);
  if (lang === "hi") {
    const lead = bestsellers ? "ये हमारी शेल्फ़ की कुछ सबसे पसंद की जाने वाली बेस्टसेलर हैं:" : reader === "casual" ? "आपके लिए कुछ हल्की-फुल्की, मज़ेदार किताबें:" : "मुझे लगता है ये आपको पसंद आएँगी:";
    return `${lead} ${list}। किसी पर भी टैप कीजिए, मैं उसे शेल्फ़ से लेकर आती हूँ — या थोड़ा और बताइए, मैं और बेहतर सुझाऊँगी।`;
  }
  const lead = bestsellers
    ? "Here are some of the most-loved bestsellers on our shelves:"
    : reader === "casual"
      ? "Here are a few easy, absorbing reads I think you'll enjoy:"
      : reader === "avid"
        ? "For a reader like you, I'd pick:"
        : "Here are a few I think you'll love:";
  return `${lead} ${list}. Tap any of them and I'll fetch it from the shelf — or tell me a bit more and I'll fine-tune the picks.`;
}

function templateFound(hit: SearchHit, lang: Lang): string {
  const b = hit.book;
  const sec = hit.location.section;
  if (lang === "hi") return `"${b.title}" (${b.authors[0]}) — बढ़िया चुनाव! यह सेक्शन ${sec}, ${sectionName(sec, "hi")} में है। आइए, मेरे साथ चलिए, मैं इसे आपके लिए निकालती हूँ।`;
  return `"${b.title}" by ${b.authors[0]} — lovely choice! It lives in Section ${sec}, ${sectionName(sec, "en")}. Come with me and I'll take it down for you.`;
}

function templateAnswer(q: string, b: Book, lang: Lang, similar: SearchHit[]): string {
  const ql = q.toLowerCase();
  const author = b.authors.join(", ");
  const sim = similar[0]?.book.title;
  if (lang === "hi") {
    if (/किसने|kisne|kiske|author|लेखक|writer/.test(ql)) return `"${b.title}" ${author} ने लिखी है${b.year ? `, और यह ${b.year > 0 ? b.year : `लगभग ${-b.year} ईसा पूर्व`} में प्रकाशित हुई थी` : ""}।`;
    if (/कितने|kitne|pages|पन्ने/.test(ql)) return b.pages ? `इसमें लगभग ${b.pages} पन्ने हैं।` : `मेरे पास इसके पन्नों की संख्या नहीं है।`;
    if (/कब|kab|year|published/.test(ql)) return b.year ? `यह ${b.year} में प्रकाशित हुई थी।` : `इसके प्रकाशन वर्ष की जानकारी मेरे पास नहीं है।`;
    if (/similar|ऐसी|जैसी|jaisi/.test(ql)) return sim ? `अगर यह पसंद आए तो "${sim}" भी पढ़िए।` : `मैं ऐसी और किताबें ढूँढ सकती हूँ, बस कहिए।`;
    return `संक्षेप में: ${b.description} ${b.rating ? `पाठकों ने इसे ${b.rating}/5 रेटिंग दी है।` : ""}`.trim();
  }
  if (/who wrote|author|writer/.test(ql)) return `"${b.title}" was written by ${author}${b.year ? `, first published in ${b.year > 0 ? b.year : `around ${-b.year} BCE`}` : ""}.`;
  if (/how many pages|pages|long/.test(ql)) return b.pages ? `It runs about ${b.pages} pages${b.pages > 500 ? " — a satisfying long read" : b.pages < 250 ? " — you could finish it in a weekend" : ""}.` : "I don't have the page count for this edition.";
  if (/when|year|published/.test(ql)) return b.year ? `It was first published in ${b.year > 0 ? b.year : `around ${-b.year} BCE`}.` : "I don't have its publication year.";
  if (/good|worth|rating|recommend/.test(ql)) return b.rating ? `Readers rate it ${b.rating} out of 5. ${b.rating >= 4.2 ? "It's widely loved." : "Opinions vary, but many readers enjoy it."}` : "I don't have ratings for it, but its themes are " + b.subjects.slice(0, 3).join(", ") + ".";
  if (/similar|like this/.test(ql)) return sim ? `If you enjoy this, try "${sim}" next.` : "Ask me for something similar and I'll find a few.";
  if (/theme/.test(ql)) return `Its main themes are ${b.subjects.slice(0, 4).join(", ")}.`;
  return `${b.description}${b.rating ? ` Readers rate it ${b.rating} out of 5.` : ""}`;
}

async function understand(llm: LLMProvider | null, req: ChatRequest): Promise<ParsedIntent> {
  const fallback = ruleParse(req.message, req.lang, req.currentBook, req.lastIntent, req.lastSearch);
  if (!llm) return fallback;
  try {
    const ctx = req.currentBook ? `\nCurrently shown book: "${req.currentBook.title}" by ${req.currentBook.authors.join(", ")}.` : "";
    const last =
      (req.lastIntent ? `\nYour previous turn was of type "${req.lastIntent}".` : "") +
      (req.lastSearch?.query ? `\nThe previous suggestions were for: "${req.lastSearch.query}"${req.lastSearch.filters?.genre ? ` (genre ${req.lastSearch.filters.genre})` : ""}. If the user is refining them (shorter, longer, lighter...), keep that topic.` : "");
    const history = req.history.slice(-8).map((m) => `${m.role}: ${m.text}`).join("\n");
    const raw = await llm.complete({
      system: INTENT_SYSTEM + ctx + last,
      messages: [{ role: "user", content: `Conversation so far:\n${history}\n\nLatest user message: ${req.message}` }],
      json: true,
      temperature: 0,
      maxTokens: 300,
    });
    const p = parseJSON<ParsedIntent>(raw);
    if (!p?.intent) return fallback;
    if (p.filters?.genre && !SECTION_BY_KEY.has(p.filters.genre)) delete p.filters.genre;
    if (p.intent === "book_question" && !req.currentBook) p.intent = "general_question";
    if ((p.intent as string) === "recommend_more") p.intent = "recommend_list";
    p.language = p.language === "hi" ? "hi" : "en";
    return p;
  } catch (e) {
    console.warn("[librarian] intent LLM failed:", (e as Error).message);
    return fallback;
  }
}

async function speak(llm: LLMProvider | null, req: ChatRequest, lang: Lang, instruction: string, fallback: string, maxTokens = 260) {
  if (!llm) return fallback;
  try {
    const history = req.history.slice(-8).map((m) => ({ role: m.role === "user" ? ("user" as const) : ("assistant" as const), content: m.text }));
    const text = await llm.complete({
      system: persona(req.librarianName, req.librarianGender ?? "female", lang),
      messages: [...history, { role: "user", content: `${req.message}\n\n[Librarian notes — not visible to the user]\n${instruction}` }],
      maxTokens,
    });
    return text.trim() || fallback;
  } catch (e) {
    console.warn("[librarian] reply LLM failed:", (e as Error).message);
    return fallback;
  }
}

const bookFacts = (b: Book) =>
  JSON.stringify({ title: b.title, authors: b.authors, year: b.year, pages: b.pages, rating: b.rating, bestseller: b.bestseller, genres: b.genres, subjects: b.subjects.slice(0, 8), description: b.description, language: b.language });

export async function handleChat(req: ChatRequest): Promise<ChatResponse> {
  await engine.init();
  const llm = getLLM();
  const provider = llm?.name ?? "rules";
  const parsed = await understand(llm, req);
  const lang = parsed.language;
  const exclude = req.currentBook ? [req.currentBook.id] : [];
  const base = { lang, provider };

  switch (parsed.intent) {
    case "greeting":
      return { ...base, intent: "greeting", suggestions: CHIPS.start[lang], reply: await speak(llm, req, lang, "Greet them back warmly and ask what they're in the mood to read, or offer to suggest a few favourites.", pick(T.greet(req.librarianName), lang)) };
    case "thanks":
      return { ...base, intent: "thanks", suggestions: CHIPS.start[lang], reply: await speak(llm, req, lang, "They thanked you. Respond warmly and offer more help.", pick(T.thanks, lang)) };
    case "goodbye":
      return { ...base, intent: "goodbye", reply: await speak(llm, req, lang, "Say a warm goodbye.", pick(T.bye, lang)) };
    case "smalltalk":
      return { ...base, intent: "smalltalk", suggestions: CHIPS.start[lang], reply: await speak(llm, req, lang, "Friendly small talk. Answer naturally and personally, show interest in them; only mention books lightly if it fits.", smalltalkReply(req.message, req.librarianName, lang)) };
    case "clarify":
      return {
        ...base,
        intent: "clarify",
        suggestions: CHIPS.clarify[lang],
        reply: await speak(llm, req, lang, "They want book suggestions but haven't said what they like. Warmly ask what genres or topics they enjoy and what kind of reader they are (quick/casual vs long/deep reads, or reading for study), and offer to show all-time bestsellers instead. Do NOT recommend specific titles yet.", pick(T.clarify, lang), 300),
      };
    case "general_question": {
      // If they're asking about a book we have, answer with facts and offer it (no walking).
      const titled = await engine.findByTitle(parsed.query ?? req.message);
      if (titled) {
        const hit: SearchHit = { book: titled, score: 1, location: engine.locationOf(titled.id)!, why: ["title"] };
        const fb = templateAnswer(req.message, titled, lang, []) + (lang === "hi" ? " अगर आप चाहें तो मैं इसे शेल्फ़ से ला सकती हूँ।" : " Would you like me to bring it from the shelf?");
        const reply = await speak(llm, req, lang, `Answer their question. Relevant book in our catalogue: ${bookFacts(titled)}. Offer (don't insist) to bring it from the shelf.`, fb);
        return { ...base, intent: "general_question", results: [hit], reply };
      }
      if (llm) {
        const reply = await speak(llm, req, lang, "This is a general question, not a book request. Answer it helpfully and accurately in a friendly way. Only if it fits naturally, mention you could find a book on the topic.", "", 320);
        return { ...base, intent: "general_question", reply, suggestions: CHIPS.start[lang] };
      }
      // only offer books with a genuine keyword match — never random filler
      const related = (await engine.search(parsed.query ?? req.message, {}, { k: 3, external: false })).filter((h) => h.why.includes("keywords") && h.why.includes("semantic"));
      const fb =
        lang === "hi"
          ? `अच्छा सवाल है! मेरी असली विशेषज्ञता किताबें हैं, और अभी मेरा पूरा AI दिमाग़ जुड़ा नहीं है, इसलिए मैं अंदाज़ा नहीं लगाऊँगी।${related.length ? ` पर इस विषय पर ये किताबें मदद कर सकती हैं: ${titleList(related, lang)}।` : " क्या मैं इस विषय पर कोई किताब ढूँढूँ?"}`
          : `That's a lovely question! Books are my real expertise, and my full AI brain isn't connected right now, so I won't guess.${related.length ? ` These might help, though: ${titleList(related, lang)}.` : " Shall I look for a book on it?"}`;
      return { ...base, intent: "general_question", reply: fb, results: related, suggestions: CHIPS.start[lang] };
    }
    case "navigate_section": {
      const sec = SECTION_BY_KEY.get(parsed.sectionKey ?? "");
      if (sec) {
        const fb = lang === "hi" ? `ज़रूर! चलिए सेक्शन ${sec.id}, ${sec.name.hi} की ओर।` : `Of course! Let's head to Section ${sec.id}, ${sec.name.en}.`;
        return { ...base, intent: "navigate_section", section: sec.id, reply: await speak(llm, req, lang, `You are walking them to Section ${sec.id} (${sec.name.en}). Say so.`, fb) };
      }
      break;
    }
    case "book_question": {
      const b = req.currentBook!;
      const similar = await engine.search(`${b.subjects.slice(0, 4).join(" ")} ${b.genres[0]}`, { genre: b.genres[0] }, { k: 3, external: false, exclude: [b.id] });
      const fb = templateAnswer(req.message, b, lang, similar);
      const reply = await speak(llm, req, lang, `Answer the user's question about this book using these facts (you may add well-known general knowledge about famous books, but be accurate): ${bookFacts(b)}. Similar books in our catalog: ${similar.map((s) => s.book.title).join("; ")}`, fb);
      return { ...base, intent: "book_question", reply, suggestions: CHIPS.found[lang] };
    }
    case "recommend_list":
    case "recommend_more": {
      const results = parsed.bestsellers
        ? await engine.bestsellers(parsed.filters ?? {}, { k: 5, reader: parsed.reader, exclude })
        : await engine.search(parsed.query?.trim() || req.message, parsed.filters ?? {}, { k: 5, exclude, reader: parsed.reader });
      if (!results.length) return { ...base, intent: "recommend_list", results: [], suggestions: CHIPS.clarify[lang], reply: await speak(llm, req, lang, "Nothing matched. Apologise kindly and ask about their taste.", pick(T.none, lang)) };
      const fb = templateList(results, lang, !!parsed.bestsellers, parsed.reader);
      const reply = await speak(
        llm,
        req,
        lang,
        `You're suggesting several books (shown to the user as cards; you will NOT walk anywhere yet). ${parsed.bestsellers ? "They are bestsellers. " : ""}${parsed.reader ? `The user is a ${parsed.reader} reader. ` : ""}Books: ${results
          .slice(0, 4)
          .map((r) => `"${r.book.title}" by ${r.book.authors[0]} (${r.book.pages ?? "?"} pages, ${r.book.genres[0]})`)
          .join("; ")}. Briefly and enthusiastically mention two or three of them with a few words on why each might suit them, then invite them to tap one so you can fetch it, or to tell you more.`,
        fb,
        320,
      );
      return { ...base, intent: "recommend_list", results, reply, suggestions: CHIPS.list[lang], search: parsed.bestsellers ? null : { query: parsed.query, filters: parsed.filters } };
    }
  }

  // find_book: the user asked for one specific book → walk to it and fetch it
  const query = parsed.query?.trim() || req.message;
  const titled = (await engine.findByTitle(query)) ?? (await engine.findByTitle(req.message));
  let results = await engine.search(query, parsed.filters ?? {}, { k: 6, exclude, reader: parsed.reader });
  if (titled && !exclude.includes(titled.id)) {
    const hit: SearchHit = { book: titled, score: 1, location: engine.locationOf(titled.id)!, why: ["title"] };
    results = [hit, ...results.filter((r) => r.book.id !== titled.id)].slice(0, 6);
  }
  if (!results.length) return { ...base, intent: "find_book", results: [], suggestions: CHIPS.clarify[lang], reply: await speak(llm, req, lang, "No results found. Apologise and ask them to rephrase.", pick(T.none, lang)) };

  const target = results[0];
  const reply = await speak(
    llm,
    req,
    lang,
    `You searched the catalogue. Best match (you will now walk the user to it and take it off the shelf): ${bookFacts(target.book)} located in Section ${target.location.section} (${sectionName(target.location.section, "en")}). Alternatives: ${results
      .slice(1, 4)
      .map((r) => `"${r.book.title}" by ${r.book.authors[0]}`)
      .join("; ")}. In one or two sentences say why it fits, mention the section, and invite them to come along.`,
    templateFound(target, lang),
  );
  return { ...base, intent: "find_book", results, target, reply, suggestions: CHIPS.found[lang] };
}
