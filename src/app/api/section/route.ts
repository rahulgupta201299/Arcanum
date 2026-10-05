import { NextResponse } from "next/server";
import { engine } from "@/lib/search/engine";

export const runtime = "nodejs";

/** GET /api/section?id=3 → real catalogue books shelved in that section. */
export async function GET(req: Request) {
  await engine.init();
  const id = Number(new URL(req.url).searchParams.get("id") ?? 1);
  const items = engine.booksInSection(id).map(({ book, location }) => ({
    id: book.id,
    title: book.title,
    author: book.authors[0],
    location,
  }));
  return NextResponse.json({ items }, { headers: { "Cache-Control": "public, max-age=30" } });
}
