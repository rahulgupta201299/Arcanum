import { NextResponse } from "next/server";
import { engine } from "@/lib/search/engine";

export const runtime = "nodejs";

/** GET /api/search?q=...&author=...&genre=...&lang=...&k=10&external=1 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = u.searchParams.get("q") ?? "";
  if (!q) return NextResponse.json({ results: [] });
  const results = await engine.search(
    q,
    {
      author: u.searchParams.get("author") ?? undefined,
      genre: u.searchParams.get("genre") ?? undefined,
      language: u.searchParams.get("lang") ?? undefined,
    },
    { k: Math.min(50, Number(u.searchParams.get("k") ?? 10)), external: u.searchParams.get("external") !== "0" },
  );
  return NextResponse.json({ results, stats: engine.stats() });
}
