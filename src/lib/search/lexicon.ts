// A small bilingual concept lexicon used by the offline pipeline:
//  - translates common Hindi / Hinglish words into English search terms
//  - expands concepts into related terms so the local embedder behaves
//    "semantically" (e.g. "space adventure" ≈ "astronaut", "mars", "galaxy").
// With an LLM + real embeddings configured, this is only a fallback.

export const HI_TO_EN: Record<string, string> = {
  // devanagari
  "किताब": "book", "पुस्तक": "book", "कहानी": "story", "प्रेम": "love", "प्यार": "love", "इतिहास": "history",
  "विज्ञान": "science", "अंतरिक्ष": "space", "भविष्य": "future", "जादू": "magic", "रहस्य": "mystery",
  "जासूस": "detective", "अपराध": "crime", "युद्ध": "war", "पैसा": "money", "निवेश": "investing", "व्यापार": "business",
  "आदतें": "habits", "आदत": "habit", "प्रेरणा": "motivation", "खुशी": "happiness", "दर्शन": "philosophy",
  "अध्यात्म": "spirituality", "धर्म": "religion", "गीता": "gita", "जीवनी": "biography", "आत्मकथा": "autobiography",
  "बच्चे": "children", "बच्चों": "children", "कविता": "poetry", "शायरी": "poetry", "नाटक": "drama", "खाना": "cooking",
  "यात्रा": "travel", "कला": "art", "संगीत": "music", "हिंदी": "hindi", "भारत": "india", "भारतीय": "indian",
  "किसान": "farmer", "गाँव": "village", "गांव": "village", "दुखद": "sad", "भावुक": "emotional", "मज़ेदार": "funny",
  "मजेदार": "funny", "डरावनी": "horror", "प्रोग्रामिंग": "programming", "कंप्यूटर": "computer", "तकनीक": "technology",
  "मनोविज्ञान": "psychology", "ब्रह्मांड": "universe", "प्रकृति": "nature", "महाभारत": "mahabharata", "रामायण": "ramayana",
  "उपन्यास": "novel", "लेखक": "author", "छोटी": "short", "आसान": "easy", "शुरुआती": "beginner",
  "जासूसी": "detective", "हास्य": "funny", "दर्दभरी": "sad", "रोमांचक": "thriller",
  // author names in Devanagari → catalogue spelling
  "प्रेमचंद": "premchand", "प्रेमचन्द": "premchand", "दिनकर": "dinkar", "बच्चन": "bachchan", "टैगोर": "tagore",
  "गांधी": "gandhi", "गाँधी": "gandhi", "कलाम": "kalam", "शेक्सपियर": "shakespeare", "भारती": "bharati",
  "ग़ालिब": "ghalib", "गालिब": "ghalib", "रूमी": "rumi", "नेहरू": "nehru", "आमिष": "amish", "चेतन": "chetan", "भगत": "bhagat",
  "क्रिस्टी": "christie", "टॉलकीन": "tolkien", "रॉलिंग": "rowling", "ओरवेल": "orwell", "हरारी": "harari",
  // hinglish
  "kitab": "book", "kitaab": "book", "kahani": "story", "prem": "love", "pyaar": "love", "pyar": "love",
  "itihas": "history", "vigyan": "science", "antariksh": "space", "jaadu": "magic", "jadu": "magic",
  "rahasya": "mystery", "jasoos": "detective", "paisa": "money", "paise": "money", "vyapar": "business",
  "aadat": "habit", "aadatein": "habits", "prerna": "motivation", "khushi": "happiness", "darshan": "philosophy",
  "adhyatm": "spirituality", "jeevani": "biography", "atmakatha": "autobiography", "bachche": "children",
  "bachon": "children", "bacchon": "children", "kavita": "poetry", "shayari": "poetry", "khana": "cooking",
  "yatra": "travel", "kala": "art", "sangeet": "music", "dukhi": "sad", "bhavuk": "emotional", "mazedaar": "funny",
  "darawni": "horror", "dravni": "horror", "kisan": "farmer", "jasoosi": "detective", "jasusi": "detective", "gaon": "village", "chhoti": "short", "aasan": "easy",
};

/** Concept clusters → related terms (used for query expansion & local embeddings). */
export const CONCEPTS: Record<string, string[]> = {
  space: ["astronaut", "galaxy", "planet", "mars", "universe", "cosmos", "alien", "scifi"],
  love: ["romance", "romantic", "relationship", "marriage", "heart"],
  emotional: ["heartbreak", "tears", "moving", "sad", "love"],
  sad: ["tragedy", "loss", "grief", "emotional"],
  funny: ["humor", "comedy", "witty", "satire"],
  scary: ["horror", "gothic", "suspense"],
  horror: ["gothic", "scary", "suspense"],
  detective: ["mystery", "crime", "whodunit", "sherlock", "poirot", "investigation"],
  murder: ["mystery", "crime", "thriller", "whodunit"],
  magic: ["fantasy", "wizard", "witch", "dragon", "myth"],
  ai: ["artificial intelligence", "machine learning", "robot", "neural networks"],
  robot: ["artificial intelligence", "ai", "android", "scifi"],
  programming: ["code", "software", "algorithms", "developer", "computer science"],
  coding: ["programming", "code", "software", "developer"],
  startup: ["entrepreneur", "business", "innovation", "company"],
  money: ["finance", "investing", "wealth", "personal finance"],
  productivity: ["habits", "focus", "time", "effectiveness"],
  habit: ["habits", "behavior change", "productivity", "routine"],
  anxiety: ["mindfulness", "calm", "stress", "presence", "stoicism"],
  stress: ["mindfulness", "calm", "anxiety", "meditation"],
  meaning: ["purpose", "philosophy", "existential", "logotherapy"],
  war: ["history", "battle", "world war", "conflict"],
  india: ["indian", "bharat", "hindi", "partition", "mughal"],
  myth: ["mythology", "gods", "legend", "epic"],
  mythology: ["myth", "gods", "mahabharata", "ramayana", "greek mythology"],
  inspiring: ["inspiration", "motivation", "biography", "resilience"],
  dystopia: ["totalitarianism", "surveillance", "future", "control"],
  universe: ["cosmos", "physics", "astronomy", "space", "black holes"],
  evolution: ["biology", "genes", "darwin", "natural selection"],
  kids: ["children", "young", "fable"],
  teen: ["young adult", "children", "school"],
  cooking: ["recipes", "food", "kitchen"],
  design: ["ux", "usability", "art", "creativity"],
  poetry: ["poems", "verse", "ghazal", "shayari"],
};

/** Translate Hindi/Hinglish tokens to English, keep others. */
export function translateTokens(tokens: string[]): string[] {
  return tokens.map((t) => HI_TO_EN[t] ?? t);
}

export function expandConcepts(tokens: string[]): string[] {
  const out: string[] = [];
  for (const t of tokens) {
    const rel = CONCEPTS[t];
    if (rel) out.push(...rel);
  }
  return out;
}
