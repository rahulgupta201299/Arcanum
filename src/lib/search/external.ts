import type { Book } from "../types";
import { SECTIONS } from "../sections";
import { tokenize } from "./text";

/** Catalog source adapter — add more (WorldCat, ISBNdb, your own DB) by implementing this. */
export interface CatalogSource {
  name: string;
  search(query: string, opts: { author?: string; limit: number; signal?: AbortSignal }): Promise<Book[]>;
}

/** Map free-form subjects/categories to one of our section keys. */
export function classify(subjects: string[], fallbackText = ""): string[] {
  const hay = ` ${tokenize([...subjects, fallbackText].join(" "), true).join(" ")} `;
  const scores = SECTIONS.map((s) => ({
    key: s.key,
    score: s.keywords.reduce((acc, k) => acc + (hay.includes(` ${k.toLowerCase()} `) ? 1 : 0), 0),
  })).filter((s) => s.score > 0);
  scores.sort((a, b) => b.score - a.score);
  const keys = scores.slice(0, 2).map((s) => s.key);
  return keys.length ? keys : ["classics"];
}

const timeout = (ms: number, parent?: AbortSignal) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  parent?.addEventListener("abort", () => c.abort());
  return { signal: c.signal, done: () => clearTimeout(t) };
};

export const OpenLibrarySource: CatalogSource = {
  name: "openlibrary",
  async search(query, { author, limit, signal }) {
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
      fields: "key,title,author_name,first_publish_year,subject,language,number_of_pages_median,ratings_average,cover_i,isbn,first_sentence",
    });
    if (author) params.set("author", author);
    const t = timeout(3500, signal);
    try {
      const res = await fetch(`https://openlibrary.org/search.json?${params}`, { signal: t.signal, headers: { "User-Agent": "Arcanum/0.2" } });
      if (!res.ok) return [];
      const json = (await res.json()) as { docs: Record<string, any>[] };
      return json.docs
        .filter((d) => d.title && d.author_name?.length)
        .map((d): Book => {
          const subjects: string[] = (d.subject ?? []).slice(0, 12);
          const fs = Array.isArray(d.first_sentence) ? d.first_sentence[0] : d.first_sentence;
          return {
            id: `ol-${String(d.key).replace("/works/", "")}`,
            title: d.title,
            authors: d.author_name.slice(0, 3),
            description: fs ? String(fs) : `${d.title} by ${d.author_name[0]}. Subjects: ${subjects.slice(0, 6).join(", ") || "general"}.`,
            genres: classify(subjects, d.title),
            subjects,
            year: d.first_publish_year,
            language: d.language?.includes("hin") ? "hi" : "en",
            pages: d.number_of_pages_median,
            rating: d.ratings_average ? Math.round(d.ratings_average * 10) / 10 : undefined,
            popularity: 0.4,
            isbn: d.isbn?.[0],
            coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : undefined,
            source: "openlibrary",
          };
        });
    } catch {
      return [];
    } finally {
      t.done();
    }
  },
};

export const GoogleBooksSource: CatalogSource = {
  name: "googlebooks",
  async search(query, { author, limit, signal }) {
    const q = author ? `${query} inauthor:${author}` : query;
    const params = new URLSearchParams({ q, maxResults: String(Math.min(limit, 20)), printType: "books" });
    if (process.env.GOOGLE_BOOKS_API_KEY) params.set("key", process.env.GOOGLE_BOOKS_API_KEY);
    const t = timeout(3500, signal);
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`, { signal: t.signal });
      if (!res.ok) return [];
      const json = (await res.json()) as { items?: { id: string; volumeInfo: Record<string, any> }[] };
      return (json.items ?? [])
        .filter((i) => i.volumeInfo?.title && i.volumeInfo?.authors?.length)
        .map(({ id, volumeInfo: v }): Book => {
          const subjects: string[] = v.categories ?? [];
          return {
            id: `gb-${id}`,
            title: v.subtitle ? `${v.title}: ${v.subtitle}` : v.title,
            authors: v.authors.slice(0, 3),
            description: (v.description ?? `${v.title} by ${v.authors[0]}.`).replace(/<[^>]+>/g, "").slice(0, 900),
            genres: classify(subjects, `${v.title} ${v.description ?? ""}`.slice(0, 400)),
            subjects,
            year: v.publishedDate ? parseInt(v.publishedDate.slice(0, 4), 10) : undefined,
            language: v.language ?? "en",
            pages: v.pageCount,
            rating: v.averageRating,
            popularity: v.ratingsCount ? Math.min(1, Math.log10(v.ratingsCount + 1) / 4) : 0.3,
            isbn: v.industryIdentifiers?.[0]?.identifier,
            coverUrl: v.imageLinks?.thumbnail?.replace("http://", "https://"),
            source: "googlebooks",
          };
        });
    } catch {
      return [];
    } finally {
      t.done();
    }
  },
};

export function enabledSources(): CatalogSource[] {
  const out: CatalogSource[] = [];
  if (process.env.ENABLE_OPEN_LIBRARY !== "false") out.push(OpenLibrarySource);
  if (process.env.ENABLE_GOOGLE_BOOKS !== "false") out.push(GoogleBooksSource);
  return out;
}
