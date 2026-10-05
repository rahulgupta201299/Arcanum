// Shared domain types used by both the server (AI/search) and the client (3D world).

export type Lang = "en" | "hi";

export type SectionId = number;

export interface Section {
  id: SectionId;
  key: string;
  name: { en: string; hi: string };
  color: string; // accent used for signage + spine palette bias
  keywords: string[]; // routing keywords (EN + HI transliterations)
}

export interface Book {
  id: string;
  title: string;
  authors: string[];
  description: string;
  genres: string[]; // section keys, primary first
  subjects: string[];
  year?: number;
  language: string; // ISO-ish: en, hi, fr ...
  pages?: number;
  rating?: number; // 0..5
  popularity?: number; // 0..1 prior
  bestseller?: boolean;
  isbn?: string;
  coverUrl?: string;
  source: "seed" | "openlibrary" | "googlebooks";
}

/** Where a book physically lives in the virtual library. */
export interface ShelfLocation {
  section: SectionId;
  row: 0 | 1; // left or right shelf row in the section
  bay: number; // 0..BAYS-1 along the row
  shelf: number; // 0..SHELVES-1 vertical level
  slot: number; // 0..SLOTS-1 horizontal position on the shelf
}

export interface SearchFilters {
  author?: string;
  genre?: string; // section key
  language?: string;
  yearFrom?: number;
  yearTo?: number;
}

export interface SearchHit {
  book: Book;
  score: number;
  location: ShelfLocation;
  why: string[]; // explanation of the match signals
}

export type Intent =
  | "greeting"
  | "find_book" // a specific book the librarian should physically fetch
  | "recommend_list" // several suggestions shown as cards — no walking
  | "clarify" // vague request: ask about taste / reader type first
  | "general_question" // not about finding a book: just answer
  | "book_question"
  | "recommend_more"
  | "navigate_section"
  | "smalltalk"
  | "thanks"
  | "goodbye";

export type ReaderType = "casual" | "avid" | "student" | "young";

export interface ParsedIntent {
  intent: Intent;
  language: Lang;
  query?: string;
  filters?: SearchFilters;
  sectionKey?: string;
  bestsellers?: boolean;
  reader?: ReaderType;
}

export interface ChatMessage {
  role: "user" | "librarian";
  text: string;
  lang?: Lang;
}

export interface ChatRequest {
  message: string;
  lang: Lang;
  history: ChatMessage[];
  currentBook?: Book | null;
  librarianName: string;
  librarianGender?: "male" | "female";
  /** intent of the librarian's previous turn (e.g. "clarify") for multi-turn context */
  lastIntent?: Intent | null;
  /** the topic of the previous suggestions, so "something shorter" keeps the same theme */
  lastSearch?: { query?: string; filters?: SearchFilters } | null;
}

export interface ChatResponse {
  reply: string;
  lang: Lang;
  intent: Intent;
  /** Present when the librarian should go fetch a book. */
  results?: SearchHit[];
  /** The book the librarian will physically fetch. */
  target?: SearchHit | null;
  /** Present when the user asked to be taken to a section. */
  section?: SectionId | null;
  /** follow-up quick replies shown as chips */
  suggestions?: string[];
  /** the search that produced `results` (sent back as context next turn) */
  search?: { query?: string; filters?: SearchFilters } | null;
  provider: string;
}
