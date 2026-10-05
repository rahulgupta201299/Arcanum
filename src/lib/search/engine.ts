import { SEED_BOOKS } from "@/data/seedCatalog";
import { sectionIdForKey } from "../sections";
import type { Book, ReaderType, SearchFilters, SearchHit, SectionId, ShelfLocation } from "../types";
import { PREFERRED_SHELVES, LAYOUT, slotFromIndex, slotIndex } from "../world/layout";
import { BM25Index } from "./bm25";
import { getEmbedder } from "./embeddings";
import { enabledSources } from "./external";
import { expandConcepts, translateTokens } from "./lexicon";
import { hash32, normalize, terms } from "./text";
import { InMemoryVectorIndex } from "./vectorIndex";

interface Meta {
  genres: string[];
  language: string;
  authors: string;
  year?: number;
}

/**
 * Hybrid search engine:
 *   vector (semantic) + BM25 (lexical) + external APIs (long tail)
 *   → metadata filters → Reciprocal Rank Fusion + priors → diversity
 * Books discovered externally are embedded and cached (the library grows).
 */
class SearchEngine {
  private books = new Map<string, Book>();
  private locations = new Map<string, ShelfLocation>();
  private occupied = new Map<SectionId, Set<number>>();
  private vectors = new InMemoryVectorIndex<Meta>();
  private bm25 = new BM25Index();
  private embedderName = "";
  private ready: Promise<void> | null = null;
  private externalCache = new Map<string, Book[]>();

  init() {
    if (!this.ready) this.ready = this.addBooks(SEED_BOOKS);
    return this.ready;
  }

  private docText(b: Book) {
    return `${b.title}. ${b.authors.join(", ")}. ${b.genres.join(" ")}. ${b.subjects.join(", ")}. ${b.description}`;
  }

  async addBooks(list: Book[]) {
    const fresh = list.filter((b) => !this.books.has(b.id) && !this.isDuplicate(b));
    if (!fresh.length) return;
    const embedder = getEmbedder();
    const vecs = await embedder.embed(fresh.map((b) => this.docText(b)));
    if (this.embedderName && this.embedderName !== embedder.name) {
      // provider fell back mid-flight → rebuild so every vector shares one space
      this.embedderName = embedder.name;
      const all = [...this.books.values()];
      const re = await embedder.embed(all.map((b) => this.docText(b)));
      this.vectors.clear();
      await this.vectors.upsert(all.map((b, i) => ({ id: b.id, vector: re[i], meta: this.meta(b) })));
    }
    this.embedderName = embedder.name;
    fresh.forEach((b, i) => {
      this.books.set(b.id, b);
      this.place(b);
      this.bm25.add(b.id, [
        { text: b.title, weight: 3 },
        { text: b.authors.join(" "), weight: 2.5 },
        { text: b.subjects.join(" ") + " " + b.genres.join(" "), weight: 1.5 },
        { text: b.description, weight: 1 },
      ]);
    });
    await this.vectors.upsert(fresh.map((b, i) => ({ id: b.id, vector: vecs[i], meta: this.meta(b) })));
  }

  private titleKey(b: Book) {
    return normalize(b.title.replace(/\(.*?\)/g, "")).split(":")[0] + "|" + normalize(b.authors[0] ?? "").split(" ").pop();
  }
  private titleKeys = new Set<string>();
  private isDuplicate(b: Book) {
    const k = this.titleKey(b);
    if (this.titleKeys.has(k)) return true;
    this.titleKeys.add(k);
    return false;
  }

  private meta(b: Book): Meta {
    return { genres: b.genres, language: b.language, authors: normalize(b.authors.join(" ")), year: b.year };
  }

  /** Deterministic, collision-free shelf address. */
  private place(b: Book): ShelfLocation {
    const existing = this.locations.get(b.id);
    if (existing) return existing;
    const section = sectionIdForKey(b.genres[0]);
    const occ = this.occupied.get(section) ?? new Set<number>();
    this.occupied.set(section, occ);
    const h = hash32(b.id);
    const row = (h & 1) as 0 | 1;
    const bay = (h >>> 1) % LAYOUT.BAYS;
    const shelf = PREFERRED_SHELVES[((h >>> 4) % 3)]; // eye-level shelves first
    const slot = 2 + ((h >>> 8) % (LAYOUT.SLOTS - 4));
    let idx = slotIndex({ section, row, bay, shelf, slot });
    const total = 2 * LAYOUT.BAYS * LAYOUT.SHELVES * LAYOUT.SLOTS;
    // keep neighbours apart (every 3rd slot) so picked books are easy to see
    for (let probe = 0; probe < total && (occ.has(idx) || occ.has(idx - 1) || occ.has(idx + 1)); probe++)
      idx = (idx + 7) % total;
    occ.add(idx);
    const loc = slotFromIndex(section, idx);
    this.locations.set(b.id, loc);
    return loc;
  }

  getBook(id: string) {
    return this.books.get(id) ?? null;
  }
  locationOf(id: string) {
    return this.locations.get(id) ?? null;
  }

  /** Real catalogue books living in a section (client renders them on shelves). */
  booksInSection(section: SectionId) {
    const out: { book: Book; location: ShelfLocation }[] = [];
    for (const [id, loc] of this.locations) if (loc.section === section) out.push({ book: this.books.get(id)!, location: loc });
    return out;
  }

  stats() {
    return { books: this.books.size, embedder: this.embedderName, vectors: this.vectors.size() };
  }

  private async fetchExternal(query: string, author?: string): Promise<Book[]> {
    const key = `${normalize(query)}|${author ?? ""}`;
    const cached = this.externalCache.get(key);
    if (cached) return cached;
    const results = await Promise.all(enabledSources().map((s) => s.search(query, { author, limit: 12 }).catch(() => [])));
    const merged = results.flat();
    this.externalCache.set(key, merged);
    if (this.externalCache.size > 500) this.externalCache.delete(this.externalCache.keys().next().value!);
    return merged;
  }

  /** A catalogue book whose title the query names (exact / containment), if any. */
  async findByTitle(query: string): Promise<Book | null> {
    await this.init();
    const q = normalize(query);
    if (q.length < 3) return null;
    let best: Book | null = null;
    for (const b of this.books.values()) {
      const variants = [b.title, ...(b.title.match(/\((.*?)\)/)?.slice(1) ?? []), b.title.replace(/\(.*?\)/g, "")].map(normalize).filter(Boolean);
      for (const t of variants) {
        // exact title, or a multi-word title quoted inside the request ("get me the name of the wind")
        const words = t.split(" ").length;
        const qWords = q.split(" ").length;
        const contained =
          ` ${q} `.includes(` ${t} `) &&
          ((words >= 2 && t.length >= 8 && t.length >= q.length * 0.4) || // "get me the name of the wind"
            (words === 1 && t.length >= 4 && qWords <= 5 && !GENERIC_TITLE_WORDS.has(t))); // "who wrote hamlet"
        if (t === q || contained) {
          if (!best || b.title.length > best.title.length) best = b;
        }
      }
    }
    return best;
  }

  /** Best-selling titles (optionally within a genre / tailored to a reader type). */
  async bestsellers(filters: SearchFilters = {}, opts: { k?: number; reader?: ReaderType; exclude?: string[] } = {}): Promise<SearchHit[]> {
    await this.init();
    const exclude = new Set(opts.exclude ?? []);
    const list = [...this.books.values()]
      .filter((b) => !exclude.has(b.id) && (b.bestseller || (b.popularity ?? 0) > 0.8))
      .filter((b) => !filters.genre || b.genres.includes(filters.genre))
      .filter((b) => !filters.language || filters.language === "any" || b.language === filters.language)
      .map((b) => ({ b, s: (b.bestseller ? 1 : 0) + (b.popularity ?? 0) + readerBoost(b, opts.reader) * 0.6 }))
      .sort((a, b) => b.s - a.s);
    const out: SearchHit[] = [];
    const genres = new Map<string, number>();
    for (const { b, s } of list) {
      const g = b.genres[0];
      if (!filters.genre && (genres.get(g) ?? 0) >= 2) continue; // keep the mix varied
      genres.set(g, (genres.get(g) ?? 0) + 1);
      out.push({ book: b, score: Math.round(s * 1000) / 1000, location: this.place(b), why: ["bestseller"] });
      if (out.length >= (opts.k ?? 5)) break;
    }
    return out;
  }

  async search(query: string, filters: SearchFilters = {}, opts: { k?: number; external?: boolean; exclude?: string[]; reader?: ReaderType } = {}): Promise<SearchHit[]> {
    await this.init();
    const k = opts.k ?? 6;
    const exclude = new Set(opts.exclude ?? []);
    const q = [query, filters.author ?? ""].join(" ").trim();

    // 1. external long-tail recall (parallel with local)
    const externalP = opts.external !== false ? this.fetchExternal(query, filters.author) : Promise.resolve([]);

    // 2. local semantic + lexical
    const expanded = q + " " + expandConcepts(translateTokens(terms(q))).join(" ");
    const [qv] = await getEmbedder().embed([expanded]);
    const external = await externalP;
    if (external.length) await this.addBooks(external);

    const filterFn = (m: Meta) => {
      if (filters.genre && !m.genres.includes(filters.genre)) return false;
      if (filters.language && filters.language !== "any" && m.language !== filters.language) return false;
      if (filters.yearFrom && (m.year ?? 0) < filters.yearFrom) return false;
      if (filters.yearTo && (m.year ?? 9999) > filters.yearTo) return false;
      if (filters.author) {
        const want = translateTokens(terms(filters.author)).filter((t) => t.length > 2);
        if (want.length && !want.some((t) => m.authors.includes(t))) return false;
      }
      return true;
    };

    let vec = await this.vectors.search(qv, 60, filterFn);
    let lex = this.bm25.search(expanded, 60).filter((r) => filterFn(this.meta(this.books.get(r.id)!)));
    // relax filters if they eliminated everything
    if (!vec.length && !lex.length) {
      vec = await this.vectors.search(qv, 60);
      lex = this.bm25.search(expanded, 60);
    }

    // 3. Reciprocal Rank Fusion + priors
    const K = 40;
    const fused = new Map<string, { score: number; why: Set<string> }>();
    const bump = (id: string, s: number, why: string) => {
      if (exclude.has(id)) return;
      const e = fused.get(id) ?? { score: 0, why: new Set<string>() };
      e.score += s;
      e.why.add(why);
      fused.set(id, e);
    };
    vec.forEach((r, i) => bump(r.id, 1 / (K + i) + Math.max(0, r.score) * 0.02, "semantic"));
    lex.forEach((r, i) => bump(r.id, 1.2 / (K + i), "keywords"));
    const extIds = new Set(external.map((b) => b.id));
    const nq = normalize(query);
    for (const [id, e] of fused) {
      const b = this.books.get(id)!;
      const nt = normalize(b.title);
      if (nq.length > 3 && (nt === nq || nt.includes(nq) || (nq.includes(nt) && nt.length > 4))) {
        e.score += 0.05;
        e.why.add("title");
      }
      if (filters.author && translateTokens(terms(filters.author)).some((t) => t.length > 2 && normalize(b.authors.join(" ")).includes(t))) {
        e.score += 0.03;
        e.why.add("author");
      }
      if (filters.genre && b.genres[0] === filters.genre) e.score += 0.008;
      e.score += (b.popularity ?? 0.4) * 0.006 + (b.rating ?? 3.5) * 0.001 + readerBoost(b, opts.reader) * 0.01;
      if (extIds.has(id)) e.why.add("internet");
    }

    // 4. diversity: soften repeated authors
    const ranked = [...fused.entries()].sort((a, b) => b[1].score - a[1].score);
    const seenAuthor = new Map<string, number>();
    const out: SearchHit[] = [];
    for (const [id, e] of ranked) {
      const b = this.books.get(id)!;
      const a = b.authors[0] ?? "";
      const n = seenAuthor.get(a) ?? 0;
      if (n >= 2 && !filters.author) continue;
      seenAuthor.set(a, n + 1);
      out.push({ book: b, score: Math.round(e.score * 1e4) / 1e4, location: this.place(b), why: [...e.why] });
      if (out.length >= k) break;
    }
    return out;
  }
}

/** One-word titles that are too common to be treated as a title mention. */
const GENERIC_TITLE_WORDS = new Set(["library", "book", "books", "name", "love", "home", "life", "time", "story", "world", "this", "that", "money", "habits", "wonder", "becoming", "educated"]);

/** Tailor ranking to the kind of reader: quick reads for casual readers, depth for avid ones. */
function readerBoost(b: Book, reader?: ReaderType): number {
  if (!reader) return 0;
  const pages = b.pages ?? 350;
  switch (reader) {
    case "casual":
      return (pages < 330 ? 1 : pages < 450 ? 0.4 : -0.6) + (b.bestseller ? 0.4 : 0);
    case "avid":
      return (pages > 400 ? 0.8 : 0) + (b.genres.includes("classics") ? 0.6 : 0) + ((b.rating ?? 0) >= 4.3 ? 0.3 : 0);
    case "student":
      return ["science", "technology", "history", "philosophy", "business"].some((g) => b.genres.includes(g)) ? 1 : -0.2;
    case "young":
      return b.genres.includes("children") ? 1.2 : -0.3;
  }
}

const g = globalThis as unknown as { __libraryEngine?: SearchEngine };
export const engine: SearchEngine = g.__libraryEngine ?? (g.__libraryEngine = new SearchEngine());
