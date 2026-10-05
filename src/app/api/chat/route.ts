import { NextResponse } from "next/server";
import { z } from "zod";
import { handleChat } from "@/lib/ai/librarian";
import type { Book, ChatRequest, Intent } from "@/lib/types";

export const runtime = "nodejs";

const Body = z.object({
  message: z.string().min(1).max(1000),
  lang: z.enum(["en", "hi"]).default("en"),
  history: z.array(z.object({ role: z.enum(["user", "librarian"]), text: z.string() })).max(40).default([]),
  currentBook: z.any().nullable().optional(),
  librarianName: z.string().max(40).default("Librarian"),
  librarianGender: z.enum(["male", "female"]).default("female"),
  lastIntent: z.string().max(40).nullable().optional(),
  lastSearch: z
    .object({ query: z.string().max(300).optional(), filters: z.record(z.string(), z.any()).optional() })
    .nullable()
    .optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid request" }, { status: 400 });
  try {
    const res = await handleChat({
      ...parsed.data,
      currentBook: (parsed.data.currentBook as Book | null) ?? null,
      lastIntent: (parsed.data.lastIntent as Intent | null | undefined) ?? null,
      lastSearch: (parsed.data.lastSearch as ChatRequest["lastSearch"]) ?? null,
    });
    return NextResponse.json(res);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "librarian unavailable" }, { status: 500 });
  }
}
