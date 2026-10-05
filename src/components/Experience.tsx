"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useLibrary, type Quality } from "@/store/useLibrary";
import { rt } from "@/lib/world/runtime";
import { BookCard } from "./ui/BookCard";
import { ChatPanel } from "./ui/ChatPanel";
import { GateScreen } from "./ui/GateScreen";
import { Hud } from "./ui/Hud";
import { RecsTray } from "./ui/RecsTray";
import { useExperienceEffects } from "./ui/useExperienceEffects";

// The WebGL world is client-only and code-split from the UI shell.
const Scene = dynamic(() => import("./world/Scene").then((m) => m.Scene), {
  ssr: false,
  loading: () => <div className="loader">Preparing the library…</div>,
});
const Inspector = dynamic(() => import("./inspector/Inspector").then((m) => m.Inspector), { ssr: false });

export default function Experience() {
  useExperienceEffects();
  useEffect(() => {
    // ?q=low|medium|high to force a quality tier; otherwise guess from the device
    const q = new URLSearchParams(location.search).get("q") as Quality | null;
    const mobile = matchMedia("(pointer: coarse)").matches || innerWidth < 760;
    useLibrary.getState().set("quality", q ?? (mobile ? "medium" : "high"));
    const speed = Number(new URLSearchParams(location.search).get("speed"));
    if (speed > 0) rt.dtMax = Math.min(1, 0.05 * speed);
    const lang = new URLSearchParams(location.search).get("lang");
    if (lang === "hi" || lang === "en") useLibrary.getState().setLang(lang);
  }, []);
  return (
    <main className="experience">
      <div className="canvas-wrap">
        <Scene />
      </div>
      <Hud />
      <BookCard />
      <RecsTray />
      <ChatPanel />
      <Inspector />
      <GateScreen />
    </main>
  );
}
