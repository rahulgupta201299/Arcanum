import { existsSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { engine } from "@/lib/search/engine";
import { getLLM } from "@/lib/ai/providers";

export const runtime = "nodejs";

export async function GET() {
  await engine.init();
  return NextResponse.json({
    llm: getLLM()?.name ?? "rules",
    tts: process.env.TTS_PROVIDER === "openai" && process.env.OPENAI_API_KEY ? "openai" : "browser",
    models: {
      female: existsSync(path.join(process.cwd(), "public/models/librarian-female.glb")),
      male: existsSync(path.join(process.cwd(), "public/models/librarian-male.glb")),
    },
    ...engine.stats(),
  });
}
