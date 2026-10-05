import { SECTIONS } from "../sections";
import type { Lang } from "../types";

/**
 * Knowledge the librarian can use without an LLM:
 *  1. facts about Arcanum itself (name, how it works, sections…)
 *  2. short encyclopedic answers from Wikipedia for general questions
 */

export const LIBRARY_FACTS = `About Arcanum (the library you work in):
- The name "Arcanum" is Latin for "a secret" or "hidden knowledge"; alchemists used it for their most precious mysteries. It suits a library that holds every book ever written, waiting to be discovered.
- It is an infinite, enchanted 3D library with ${SECTIONS.length} themed, numbered sections that repeat into endless annexes; new books found on the internet (Open Library, Google Books) get a permanent shelf.
- Visitors can type or speak in English or Hindi. You can suggest books, show bestsellers, answer questions, walk them to a section, take a book off the shelf and hand it over so they can inspect it in 3D.`;

const RX_LIBRARY =
  /\b(arcanum|this (library|place)|the library|library'?s? name|name of (the|this|your) library|why .*\bname\b|who (made|built|created|designed) (you|this|the library)|how (does|do) (this|you|the library) work|what (is|can) (this|you)|how many (books|sections)|what sections|which sections)\b|\b(is|iss|ye|yeh|this) library\b|library ka (naam|name)|\bnaam kya\b|आर्केनम|अर्कानम|इस (पुस्तकालय|लाइब्रेरी)|लाइब्रेरी का नाम|पुस्तकालय का नाम|नाम क्यों|कितने सेक्शन|कितनी किताबें/i;

export function libraryFAQ(message: string, lang: Lang, name: string): string | null {
  const m = message.toLowerCase();
  if (!RX_LIBRARY.test(m)) return null;
  const hi = lang === "hi";
  if (/name|naam|arcanum|नाम|आर्केनम|अर्कानम/.test(m))
    return hi
      ? `इस पुस्तकालय का नाम Arcanum है! "Arcanum" एक लैटिन शब्द है, जिसका अर्थ है "रहस्य" या "छिपा हुआ ज्ञान" — पुराने कीमियागर इसे अपने सबसे कीमती रहस्यों के लिए इस्तेमाल करते थे। यह नाम इस पुस्तकालय पर खूब जँचता है, क्योंकि यहाँ दुनिया की हर किताब खोजे जाने का इंतज़ार कर रही है — और मुझे पता है कि कौन-सी किताब कहाँ रखी है!`
      : `This library is called Arcanum! The name is Latin for "a secret" or "hidden knowledge" — the old alchemists used it for their most precious mysteries. It felt just right for a library that holds every book ever written, all waiting to be discovered. And luckily, I know where every one of them is kept!`;
  if (/how many|sections|कितने|सेक्शन/.test(m))
    return hi
      ? `यहाँ ${SECTIONS.length} मुख्य सेक्शन हैं — क्लासिक्स, रहस्य, विज्ञान कथा, फैंटेसी, प्रेम कथाएँ, इतिहास, विज्ञान, तकनीक, व्यापार, आत्म-विकास, दर्शन, जीवनी, भारतीय साहित्य, बाल साहित्य, कविता और कला — और ये अनंत उपखंडों में आगे बढ़ते रहते हैं। इंटरनेट से मिली हर नई किताब को भी यहाँ एक शेल्फ़ मिल जाती है।`
      : `There are ${SECTIONS.length} main sections — classics, mystery, sci-fi, fantasy, romance, history, science, technology, business, self-help, philosophy, biography, Indian literature, children's books, poetry and the arts — and they carry on into endless annexes. Every new book we find on the internet gets a shelf of its own.`;
  if (/who (made|built|created|designed)|किसने/.test(m))
    return hi
      ? `Arcanum को किताबों से प्यार करने वालों के लिए बनाया गया है — AI, 3D दुनिया और आवाज़ को मिलाकर, ताकि किताब ढूँढना किसी असली पुस्तकालय में घूमने जैसा लगे। और मैं, ${name}, यहाँ की लाइब्रेरियन हूँ।`
      : `Arcanum was built for book lovers — blending AI, a 3D world and voice so finding a book feels like wandering a real library. And I'm ${name}, the librarian who looks after it all.`;
  return hi
    ? `Arcanum एक अनंत, जादुई पुस्तकालय है। आप मुझसे हिंदी या अंग्रेज़ी में बात कर सकते हैं — मैं किताबें सुझा सकती हूँ, बेस्टसेलर दिखा सकती हूँ, सवालों के जवाब दे सकती हूँ, और कोई भी किताब शेल्फ़ से लाकर आपके हाथ में दे सकती हूँ।`
    : `Arcanum is an infinite, enchanted library. You can talk to me in English or Hindi — I can suggest books, show you bestsellers, answer questions, and fetch any book from the shelves and put it right in your hands.`;
}

/** Turn a question into a search phrase: "what is the capital of France?" → "capital of France". */
function topicOf(q: string) {
  return q
    .replace(/[?¿!.]+$/g, "")
    .replace(/^(please\s+)?(can you\s+)?(tell me|explain|do you know)\s+/i, "")
    .replace(/^(what|who|whom|where|when|why|how|which)\s+(is|are|was|were|did|does|do|was the|is the)?\s*/i, "")
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/(\s+)?(क्या है|कौन है|कौन था|कौन थे|क्या होता है|के बारे में बताओ|बताइए|बताओ)$/u, "")
    .trim();
}

async function getJSON<T>(url: string, ms = 3500): Promise<T | null> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { "User-Agent": "Arcanum/0.2 (AI library)", Accept: "application/json" } });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** A short, sourced answer from Wikipedia (first 2 sentences of the best page), or null. */
export async function wikiAnswer(question: string, lang: Lang): Promise<{ text: string; title: string } | null> {
  if (process.env.ENABLE_WIKIPEDIA === "false") return null;
  const topic = topicOf(question);
  if (topic.length < 2) return null;
  for (const wl of lang === "hi" ? ["hi", "en"] : ["en"]) {
    const search = await getJSON<{ pages?: { key: string; title: string }[] }>(
      `https://${wl}.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(topic)}&limit=1`,
    );
    const page = search?.pages?.[0];
    if (!page) continue;
    const sum = await getJSON<{ extract?: string; type?: string; title?: string }>(`https://${wl}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.key)}`);
    if (!sum?.extract || sum.type === "disambiguation") continue;
    // split on sentence ends only when the next sentence starts (keeps "2.1 million" intact)
    const sentences = sum.extract.split(/(?<=[.!?।])\s+(?=[A-Z\u0900-\u097F"“(])/u);
    return { text: sentences.slice(0, 2).join(" ").trim(), title: sum.title ?? page.title };
  }
  return null;
}
