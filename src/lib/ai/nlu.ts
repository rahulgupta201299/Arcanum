import { SECTIONS } from "../sections";
import { HI_TO_EN } from "../search/lexicon";
import { detectLang, normalize } from "../search/text";
import type { Book, Intent, Lang, ParsedIntent, ReaderType, SearchFilters } from "../types";

/**
 * Offline rule-based NLU (English + Hindi/Hinglish). Used when no LLM is
 * configured and as a safety net if the LLM call fails.
 */
// Unicode-aware word boundary (\b does not work for Devanagari).
const B = (src: string) => new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])(?:${src})(?![\\p{L}\\p{M}\\p{N}])`, "iu");

const RX = {
  greet: new RegExp(`^(?:hi|hello|hey|hii+|namaste|namaskar|good (?:morning|evening|afternoon)|नमस्ते|नमस्कार|हेलो)(?![\\p{L}\\p{M}])`, "iu"),
  thanks: B("thanks|thank you|thx|dhanyavaad|dhanyavad|shukriya|धन्यवाद|शुक्रिया"),
  bye: B("bye|goodbye|see you|alvida|अलविदा"),
  more: B("another|something else|different one|more like|similar|one more|next one|aur koi|dusri|doosri|kuch aur|aur dikhao|और कोई|दूसरी|कुछ और|ऐसी और"),
  navigate: B("take me to|go to|walk me to|le chalo|le chaliye|ले चलो|ले चलिए|section|vibhag|विभाग|सेक्शन"),
  about: B("who wrote|author|writer|what is (?:it|this) about|about this|tell me (?:more )?about|summary|summari[sz]e|plot|how many pages|pages|when was (?:it|this)|published|is it good|rating|worth reading|why (?:should|would) i read|similar to this|theme|themes|kiske|kisne|kya hai|kitne|kab|kahani kya|iske baare|इसके बारे|किसने|कितने|कब|क्या है|कहानी क्या"),
  /** questions about Arcanum / the library itself */
  library: B("arcanum|this library|is library|iss library|library ka naam|library ka name|the library|this place|your library|library'?s? name|आर्केनम|अर्कानम|इस लाइब्रेरी|इस पुस्तकालय|लाइब्रेरी का नाम|पुस्तकालय का नाम"),
  refersBook: B("this|it|its|the book|is book|iska|iski|iske|ye|yeh|isme|इस|यह|ये|इसकी|इसका|इसके|इसमें"),
  smalltalk: B("how are you|who are you|what's up|whats up|what is your name|your name|kaise ho|kaisi ho|aap kaun|tum kaun|aap kaise|कैसे हो|कैसी हो|आप कौन|आपका नाम"),
  findVerb: B("find|search|look for|looking for|recommend|suggest|show|need|want|get me|bring|chahiye|dhoondo|dhundo|dikhao|batao|suggest karo|चाहिए|ढूंढो|दिखाओ|बताओ"),
  /** asking for ideas rather than one specific book */
  suggest: B("suggest|suggestions?|recommend|recommendations?|any good books?|some books?|few books|good books?|what should i read|what to read|what can i read|something to read|something good|kya padh(?:u|un|na chahiye)|kuch (?:accha|achha|acchi|achhi)|sujhao|sujhav|सुझाव|सुझाओ|क्या पढ़ूँ|क्या पढ़ूं|कुछ अच्छा|कोई अच्छी"),
  plural: B("books|novels|titles|options|list|kitabein|kitaabein|kitaben|किताबें|पुस्तकें"),
  bestseller: B("best ?sellers?|best[- ]selling|most popular|popular books?|top books?|top \\d+|famous books?|must[- ]reads?|all[- ]time|trending|classics everyone|sabse (?:mashhoor|popular|zyada bikne)|बेस्टसेलर|सबसे लोकप्रिय|मशहूर किताबें"),
  /** the user wants ONE book physically brought to them */
  fetch: B("get me|bring me|bring|fetch|take me to the book|where is|where can i find|i want to read|i want the|i need the|i'd like the|show me the book|give me|hand me|la do|laa do|lao|laao|le aao|le aaiye|दे दो|ला दो|लाओ|लाइए|कहाँ है|i want (?:a|one) (?:book|novel)|i need (?:a|one) (?:book|novel)|ek (?:kitab|kitaab|book)|एक किताब"),
  question: new RegExp(`^(?:what|who|whom|why|how|when|where|which|is|are|can|could|do|does|did|will|would|should|explain|tell me|kya|kaun|kyun|kyon|kaise|kab|kahan|kitna|क्या|कौन|क्यों|कैसे|कब|कहाँ|कितना)(?![\\p{L}\\p{M}])`, "iu"),
  bookish: B("book|books|novel|novels|read|reading|reader|author|writer|story|stories|poem|poetry|kitab|kitaab|kahani|upanyas|किताब|पुस्तक|कहानी|उपन्यास|लेखक|पढ़"),
  // reader types
  casual: B("shorter|lighter|quicker|smaller|something light|casual|occasionally|sometimes|kabhi kabhi|kabhi-kabhi|कभी-कभी|कभी कभी|beginner|new reader|not much of a reader|light read|quick read|short|easy|relaxing|busy|weekend read|shuruaati|aasan|chhoti|शुरुआती|आसान|छोटी|हल्की"),
  avid: B("longer|deeper|avid|serious reader|bookworm|voracious|read a lot|heavy|deep|long books?|challenging|literary|gambhir|गंभीर|किताबी कीड़ा"),
  student: B("student|study|studying|exam|learn|learning|college|university|vidyarthi|padhai|छात्र|विद्यार्थी|पढ़ाई"),
  young: B("kid|kids|child|children|my son|my daughter|teen|teenager|young reader|bachche|bachchon|बच्चे|बच्चों|किशोर"),
};

function extractAuthor(text: string): string | undefined {
  const m =
    text.match(/\b(?:by|written by|author)\s+([A-Za-z.\s]{3,40}?)(?:\s+(?:about|on|in|that|which|with)\b|[?.!,]|$)/i) ||
    text.match(/([A-Za-z.\s]{3,40}?)\s+(?:ki|ka|ke)\s+(?:kitab|kitaab|book|novel|books)/i) ||
    text.match(/([ऀ-ॿ\s]{2,30}?)\s+(?:की|का|के)\s+(?:किताब|पुस्तक|उपन्यास)/);
  const a = m?.[1]?.trim();
  if (!a || /^(a|an|the|some|koi|ek|meri|mujhe|मुझे|कोई|एक)$/i.test(a)) return undefined;
  const last = a.split(/\s+/).pop()!;
  return HI_TO_EN[last] ?? HI_TO_EN[a] ?? a.replace(/^(mujhe|मुझे)\s+/i, "");
}

/** Keywords too generic to decide a genre on their own. */
const WEAK_KEYS = new Set(["novel", "fiction", "upanyas", "उपन्यास", "literature", "sahitya", "साहित्य"]);

export function detectGenre(text: string): string | undefined {
  // match keywords against the text and its de-pluralised form ("thrillers" → "thriller")
  const norm = normalize(text);
  const singular = norm
    .split(" ")
    .map((w) => (/^[a-z]{4,}s$/.test(w) && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .join(" ");
  const hay = ` ${norm} ${singular} `;
  let best: { key: string; score: number } | undefined;
  for (const s of SECTIONS) {
    let score = 0;
    for (const k of s.keywords) if (hay.includes(` ${k.toLowerCase()} `)) score += WEAK_KEYS.has(k) ? 0.5 : k.length > 4 ? 2 : 1;
    if (score && (!best || score > best.score)) best = { key: s.key, score };
  }
  return best?.key;
}

function detectLanguageFilter(text: string): string | undefined {
  if (/\b(in hindi|hindi (book|novel|kitab|kitaab|books|mein|me|sahitya)|हिंदी (में|की|किताब|उपन्यास))\b/i.test(text)) return "hi";
  if (/\b(in english|english (book|novel|mein|me))\b/i.test(text)) return "en";
  return undefined;
}

/** Turn Hinglish/Hindi into an English-ish search string. */
function toQuery(text: string): string {
  return normalize(text)
    .split(" ")
    .map((t) => HI_TO_EN[t] ?? t)
    .join(" ")
    .replace(/\b(please|can you|could you|i want|i need|i am looking for|looking for|find me|find|show me|recommend me|recommend|suggest|a book|book|books|mujhe|chahiye|koi|ek|dikhao|batao)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Words that carry no topical criteria in a book request. */
const GENERIC = new Set(
  "some few any good nice great best interesting new read reading reader something anything me i you please can could would like love enjoy books book novel novels kind type sort recommend recommendation recommendations suggest suggestions suggestion should what which give tell help am also just really very want need get show find looking look for to of the a an and or with my mood today now kuch accha achha acchi achhi koi padhna padhu padhun chahiye sujhao batao dikhao kitab kitaab kitabein kitaabein mujhe main hoon hai hain pasand कुछ अच्छी अच्छा अच्छे अच्छी किताबें किताब पुस्तकें सुझाओ सुझाइए बताओ बताइए दिखाओ दिखाइए मुझे कोई पढ़ना पढ़ूँ चाहिए पसंद है हैं मैं हूँ और भी".split(" "),
);

function readerType(t: string): ReaderType | undefined {
  if (RX.young.test(t)) return "young";
  if (RX.student.test(t)) return "student";
  if (RX.avid.test(t)) return "avid";
  if (RX.casual.test(t)) return "casual";
  return undefined;
}

/** Strip reader-type words too so "I'm a casual reader" carries no topic. */
function topicalTerms(query: string) {
  return query
    .split(" ")
    .filter((w) => w.length > 2 && !GENERIC.has(w) && !RX.casual.test(w) && !RX.avid.test(w) && !RX.student.test(w) && !RX.young.test(w) && !RX.bestseller.test(w));
}

export function ruleParse(
  message: string,
  uiLang: Lang,
  currentBook?: Book | null,
  lastIntent?: Intent | null,
  lastSearch?: { query?: string; filters?: SearchFilters } | null,
): ParsedIntent {
  const language: Lang = detectLang(message) === "hi" ? "hi" : uiLang;
  const t = message.trim();
  const words = t.split(/\s+/).length;

  if (RX.greet.test(t) && words <= 4) return { intent: "greeting", language };
  if (RX.thanks.test(t) && words <= 6) return { intent: "thanks", language };
  if (RX.bye.test(t)) return { intent: "goodbye", language };

  // a question about the book in hand — but never when they're asking about the library itself
  // names another title/person ("who wrote Hamlet?") → not about the book in hand
  const namesSomethingElse = /\s[A-Z][a-z]{2,}/.test(t.replace(/^\S+/, "")) && !RX.refersBook.test(t);
  if (currentBook && RX.about.test(t) && !RX.library.test(t) && !namesSomethingElse && (RX.refersBook.test(t) || (!RX.findVerb.test(t) && words <= 5)))
    return { intent: "book_question", language };
  if (RX.library.test(t) && (RX.question.test(t) || /\?\s*$/.test(t))) return { intent: "general_question", language, query: t };

  const genre = detectGenre(t);
  if (RX.navigate.test(t) && genre && /section|सेक्शन|विभाग|vibhag|take me to|le chalo|ले चलो/i.test(t)) return { intent: "navigate_section", language, sectionKey: genre };

  const reader = readerType(t);
  const filters: SearchFilters = {};
  const author = extractAuthor(t);
  if (author) filters.author = author;
  const lang = detectLanguageFilter(t);
  if (lang) filters.language = lang;
  const query = toQuery(author ? t.replace(author, " ") : t) || genre || "";
  const topical = topicalTerms(query);
  const hasCriteria = !!(genre || author || lang || topical.length);
  if (reader === "young") filters.genre = "children";

  // "something similar" while holding a book → a list of similar books
  if (RX.more.test(t) && currentBook) {
    return {
      intent: "recommend_list",
      language,
      query: `${currentBook.subjects.slice(0, 4).join(" ")} ${currentBook.genres[0]}`,
      filters: { genre: currentBook.genres[0] },
      reader,
    };
  }

  // refining the previous suggestions ("something shorter", "I love long, deep reads")
  if (lastIntent === "recommend_list" && reader && !hasCriteria && lastSearch?.query)
    return { intent: "recommend_list", language, query: lastSearch.query, filters: { ...(lastSearch.filters ?? {}), ...filters }, reader };

  if (RX.bestseller.test(t)) return { intent: "recommend_list", language, bestsellers: true, filters: { ...filters, genre: filters.genre ?? genre }, reader, query };

  // answering the librarian's "what do you like / what kind of reader are you?"
  if (lastIntent === "clarify" && (hasCriteria || reader) && !RX.question.test(t)) {
    if (!hasCriteria) return { intent: "recommend_list", language, bestsellers: true, filters, reader };
    return { intent: "recommend_list", language, query: query || genre, filters: { ...filters, genre: filters.genre ?? (author ? undefined : genre) }, sectionKey: genre, reader };
  }

  if (RX.suggest.test(t) || (RX.plural.test(t) && !RX.fetch.test(t))) {
    // asked again without giving a taste → don't repeat the question, show all-time favourites
    if (!hasCriteria && !reader && lastIntent === "clarify") return { intent: "recommend_list", language, bestsellers: true, filters };
    if (!hasCriteria && !reader) return { intent: "clarify", language };
    if (!hasCriteria) return { intent: "recommend_list", language, bestsellers: true, filters, reader };
    return { intent: "recommend_list", language, query: query || genre, filters: { ...filters, genre: filters.genre ?? (author ? undefined : genre) }, sectionKey: genre, reader };
  }

  if (RX.fetch.test(t) || (RX.findVerb.test(t) && hasCriteria)) {
    if (!hasCriteria) return { intent: "clarify", language };
    return { intent: "find_book", language, query: query || genre, filters, sectionKey: genre, reader };
  }

  if (RX.smalltalk.test(t)) return { intent: "smalltalk", language, query: t };

  // a question that isn't about books → just answer it
  if ((RX.question.test(t) || /\?\s*$/.test(t)) && !RX.bookish.test(t) && !genre && !author) return { intent: "general_question", language, query: t };

  // bare topic / title ("Dune", "mystery novels") → the librarian decides fetch vs list via title match
  if (hasCriteria) return { intent: "find_book", language, query: query || genre, filters, sectionKey: genre, reader };
  if (reader) return { intent: "recommend_list", language, bestsellers: true, filters, reader };
  if (RX.bookish.test(t)) return { intent: "clarify", language };
  return { intent: words <= 3 ? "smalltalk" : "general_question", language, query: t };
}
