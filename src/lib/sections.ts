import type { Section, SectionId } from "./types";

/**
 * Numbered sections of the library. Sections beyond this list are generated
 * procedurally (the library is conceptually infinite) and cycle through these
 * themes with an "Annex" suffix so the world never runs out of shelves.
 */
export const SECTIONS: Section[] = [
  { id: 1, key: "classics", name: { en: "Classics & Literary Fiction", hi: "क्लासिक्स और साहित्य" }, color: "#8b2e2e", keywords: ["classic", "literary", "literature", "novel", "fiction", "sahitya", "upanyas", "साहित्य", "उपन्यास", "क्लासिक"] },
  { id: 2, key: "mystery", name: { en: "Mystery & Thriller", hi: "रहस्य और थ्रिलर" }, color: "#2f3e55", keywords: ["mystery", "thriller", "crime", "detective", "murder", "suspense", "rahasya", "jasoos", "रहस्य", "जासूस", "थ्रिलर", "अपराध"] },
  { id: 3, key: "scifi", name: { en: "Science Fiction", hi: "विज्ञान कथा" }, color: "#1f5d6b", keywords: ["sci-fi", "scifi", "science fiction", "space", "future", "dystopia", "robot", "alien", "ai", "vigyan katha", "अंतरिक्ष", "भविष्य", "विज्ञान कथा"] },
  { id: 4, key: "fantasy", name: { en: "Fantasy", hi: "फ़ैंटेसी" }, color: "#4b2c6b", keywords: ["fantasy", "magic", "dragon", "wizard", "myth", "epic", "jaadu", "जादू", "फैंटेसी", "फ़ैंटेसी"] },
  { id: 5, key: "romance", name: { en: "Romance", hi: "प्रेम कथाएँ" }, color: "#a2405a", keywords: ["romance", "love", "love story", "romantic", "prem", "pyaar", "pyar", "प्रेम", "प्यार", "रोमांस"] },
  { id: 6, key: "history", name: { en: "History", hi: "इतिहास" }, color: "#7a5a2b", keywords: ["history", "historical", "war", "empire", "ancient", "itihas", "इतिहास", "युद्ध", "साम्राज्य"] },
  { id: 7, key: "science", name: { en: "Science & Nature", hi: "विज्ञान और प्रकृति" }, color: "#2e6b3f", keywords: ["science", "physics", "biology", "universe", "cosmos", "nature", "evolution", "vigyan", "विज्ञान", "प्रकृति", "ब्रह्मांड"] },
  { id: 8, key: "technology", name: { en: "Technology & Programming", hi: "तकनीक और प्रोग्रामिंग" }, color: "#2b4f7a", keywords: ["programming", "code", "coding", "software", "computer", "technology", "tech", "machine learning", "engineering", "takneek", "तकनीक", "प्रोग्रामिंग", "कंप्यूटर"] },
  { id: 9, key: "business", name: { en: "Business & Economics", hi: "व्यापार और अर्थशास्त्र" }, color: "#5a6b2e", keywords: ["business", "startup", "economics", "money", "finance", "investing", "management", "leadership", "vyapar", "paisa", "व्यापार", "पैसा", "अर्थशास्त्र", "निवेश"] },
  { id: 10, key: "selfhelp", name: { en: "Self-Help & Psychology", hi: "आत्म-विकास और मनोविज्ञान" }, color: "#b0742a", keywords: ["self help", "self-help", "habits", "productivity", "motivation", "psychology", "mindset", "happiness", "anxiety", "aatma", "प्रेरणा", "आदतें", "मनोविज्ञान", "खुशी"] },
  { id: 11, key: "philosophy", name: { en: "Philosophy & Spirituality", hi: "दर्शन और अध्यात्म" }, color: "#3d3d6b", keywords: ["philosophy", "spiritual", "spirituality", "religion", "meditation", "stoic", "meaning", "darshan", "adhyatm", "gita", "दर्शन", "अध्यात्म", "धर्म", "गीता"] },
  { id: 12, key: "biography", name: { en: "Biography & Memoir", hi: "जीवनी और संस्मरण" }, color: "#6b4a3d", keywords: ["biography", "memoir", "autobiography", "life story", "jeevani", "atmakatha", "जीवनी", "आत्मकथा"] },
  { id: 13, key: "indian", name: { en: "Indian & Hindi Literature", hi: "भारतीय और हिंदी साहित्य" }, color: "#b5532a", keywords: ["indian", "india", "hindi", "bharat", "premchand", "हिंदी", "भारतीय", "भारत"] },
  { id: 14, key: "children", name: { en: "Children & Young Adult", hi: "बाल और किशोर साहित्य" }, color: "#2a8a7a", keywords: ["children", "kids", "child", "young adult", "ya", "teen", "bachche", "bachon", "बच्चे", "बच्चों", "किशोर"] },
  { id: 15, key: "poetry", name: { en: "Poetry & Drama", hi: "कविता और नाटक" }, color: "#6b2e5a", keywords: ["poetry", "poems", "poem", "drama", "play", "shayari", "kavita", "कविता", "शायरी", "नाटक"] },
  { id: 16, key: "arts", name: { en: "Arts, Design & Living", hi: "कला, डिज़ाइन और जीवनशैली" }, color: "#8a6a2a", keywords: ["art", "design", "cooking", "recipe", "travel", "music", "photography", "kala", "khana", "कला", "खाना", "यात्रा", "संगीत"] },
];

export const SECTION_BY_KEY = new Map(SECTIONS.map((s) => [s.key, s]));

export function sectionFor(id: SectionId): Section {
  const base = SECTIONS[(id - 1) % SECTIONS.length];
  if (id <= SECTIONS.length) return base;
  const annex = Math.floor((id - 1) / SECTIONS.length);
  return {
    ...base,
    id,
    name: { en: `${base.name.en} — Annex ${annex}`, hi: `${base.name.hi} — उपखंड ${annex}` },
  };
}

export function sectionIdForKey(key?: string): SectionId {
  return (key && SECTION_BY_KEY.get(key)?.id) || 1;
}
