import type { Lang } from "../types";

export const S = {
  title: { en: "Arcanum", hi: "Arcanum" },
  tagline: { en: "Step through the doors of an endless, enchanted library — where an AI librarian knows every book ever written and walks you to it.", hi: "एक अनंत, जादुई पुस्तकालय — जहाँ AI लाइब्रेरियन दुनिया की हर किताब जानता है और आपको उस तक ले जाता है।" },
  enter: { en: "Open the doors", hi: "द्वार खोलें" },
  enterHint: { en: "Headphones recommended · voice works in Chrome, Edge & Safari", hi: "हेडफ़ोन बेहतर रहेंगे · आवाज़ Chrome, Edge और Safari में काम करती है" },
  placeholder: { en: "Ask for any book… e.g. “a hopeful sci-fi about first contact”", hi: "कोई भी किताब माँगिए… जैसे “प्रेमचंद की कोई कहानी”" },
  listening: { en: "Listening… take your time — pause for a moment when you're done", hi: "सुन रही हूँ… आराम से बोलिए — बात पूरी होने पर थोड़ा रुकिए" },
  listeningShort: { en: "Listening…", hi: "सुन रही हूँ…" },
  send: { en: "Send", hi: "भेजें" },
  thinking: { en: "is thinking…", hi: "सोच रही हैं…" },
  walking: { en: "is leading you to Section", hi: "आपको सेक्शन की ओर ले जा रही हैं" },
  fetching: { en: "is taking the book off the shelf…", hi: "शेल्फ़ से किताब निकाल रही हैं…" },
  presenting: { en: "is holding your book", hi: "आपकी किताब थामे हुए हैं" },
  foyer: { en: "Foyer", hi: "प्रवेश कक्ष" },
  section: { en: "Section", hi: "सेक्शन" },
  inspect: { en: "Inspect book", hi: "किताब देखें" },
  ask: { en: "Ask about it", hi: "इसके बारे में पूछें" },
  more: { en: "Find similar", hi: "ऐसी और" },
  alternatives: { en: "Also on the shelves", hi: "और विकल्प" },
  close: { en: "Close", hi: "बंद करें" },
  open: { en: "Open", hi: "खोलें" },
  explore: { en: "Explore", hi: "घूमें" },
  exploreHint: { en: "WASD / arrows to walk · drag to look", hi: "चलने के लिए WASD / तीर · देखने के लिए खींचें" },
  pages: { en: "pages", hi: "पृष्ठ" },
  rating: { en: "rating", hi: "रेटिंग" },
  noVoice: { en: "Voice input isn't supported in this browser — try Chrome or Edge.", hi: "इस ब्राउज़र में वॉइस इनपुट उपलब्ध नहीं है — Chrome या Edge आज़माएँ।" },
  recsTitle: { en: "Recommended for you", hi: "आपके लिए सुझाव" },
  recsHint: { en: "Pick one and I'll fetch it from the shelf", hi: "कोई एक चुनिए, मैं शेल्फ़ से लेकर आती हूँ" },
  bestsellers: { en: "All-time bestsellers", hi: "सदाबहार बेस्टसेलर" },
  bestseller: { en: "Bestseller", hi: "बेस्टसेलर" },
  bringIt: { en: "Bring it to me", hi: "मेरे लिए लाइए" },
  suggestions: {
    en: ["Can you suggest me some books?", "Show me all-time bestsellers", "Get me a funny sci-fi novel", "Books by Premchand"],
    hi: ["कुछ अच्छी किताबें सुझाओ", "बेस्टसेलर दिखाओ", "मुझे एक भावुक प्रेम कहानी चाहिए", "प्रेमचंद की किताबें"],
  },
} satisfies Record<string, Record<Lang, string | string[]>>;

export function t<K extends keyof typeof S>(k: K, lang: Lang): (typeof S)[K][Lang] {
  return S[k][lang];
}

/** Hindi status lines use feminine verb forms by default. */
export function gendered(text: string, lang: Lang, gender: "male" | "female") {
  if (lang !== "hi" || gender === "female") return text;
  return text.replace(/रही हैं/g, "रहे हैं").replace(/रही हूँ/g, "रहा हूँ").replace(/लेकर आती हूँ/g, "लेकर आता हूँ");
}
