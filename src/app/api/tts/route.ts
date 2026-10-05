import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Optional server-side TTS (higher quality, consistent voices across devices).
 * Enabled with TTS_PROVIDER=openai. The client falls back to speechSynthesis.
 */
export async function POST(req: Request) {
  if (process.env.TTS_PROVIDER !== "openai" || !process.env.OPENAI_API_KEY)
    return NextResponse.json({ error: "server tts disabled" }, { status: 404 });
  const { text, gender, lang, accent } = (await req.json()) as { text: string; gender: "male" | "female"; lang: "en" | "hi"; accent?: "in" | "gb" };
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts",
      voice: gender === "male" ? "onyx" : "nova",
      input: String(text).slice(0, 1200),
      instructions:
        lang === "hi"
          ? "Speak as a warm, calm librarian in natural, clear Hindi."
          : `Speak as a warm, calm librarian in English with a natural, clear ${accent === "gb" ? "British (UK)" : "Indian"} accent, at an easy, unhurried pace.`,
      response_format: "mp3",
    }),
  });
  if (!res.ok) return NextResponse.json({ error: "tts failed" }, { status: 502 });
  return new Response(res.body, { headers: { "Content-Type": "audio/mpeg" } });
}
