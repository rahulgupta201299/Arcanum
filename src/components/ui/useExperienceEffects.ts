"use client";

import { useEffect, useRef } from "react";
import { audio } from "@/lib/audio/ambience";
import { getTTS } from "@/lib/voice";
import { rt } from "@/lib/world/runtime";
import { useLibrary } from "@/store/useLibrary";

/** Glue between the store, the voice layer and the sound engine. */
export function useExperienceEffects() {
  const serverTTS = useRef(false);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((s: { tts: string; llm: string; models?: { female: boolean; male: boolean } }) => {
        serverTTS.current = s.tts === "openai";
        useLibrary.getState().set("provider", s.llm);
        if (s.models) useLibrary.getState().set("models", s.models);
      })
      .catch(() => {});
  }, []);

  // speak every new librarian line
  useEffect(() => {
    let lastId = 0;
    return useLibrary.subscribe((s) => {
      const m = s.messages[s.messages.length - 1];
      if (!m || m.id === lastId) return;
      lastId = m.id;
      if (m.role !== "librarian" || !s.voiceOn) return;
      const tts = getTTS(serverTTS.current);
      void tts.speak(m.text, m.lang, s.librarian.gender, {
        onStart: () => {
          rt.lib.speaking = true;
          useLibrary.getState().set("speaking", true);
        },
        onEnd: () => {
          rt.lib.speaking = false;
          useLibrary.getState().set("speaking", false);
        },
      });
    });
  }, []);

  // stop talking when voice is muted; mute/unmute sound
  useEffect(
    () =>
      useLibrary.subscribe((s, p) => {
        if (p.voiceOn && !s.voiceOn) {
          getTTS(serverTTS.current).cancel();
          rt.lib.speaking = false;
        }
        if (p.soundOn !== s.soundOn) audio.setEnabled(s.soundOn);
        if (s.phase !== p.phase) {
          if (s.phase === "opening") {
            audio.init();
            audio.setEnabled(s.soundOn);
            audio.door();
            setTimeout(() => audio.startAmbience(), 1200);
          }
          audio.thinking(s.phase === "thinking");
        }
        if (s.listening && !p.listening) getTTS(serverTTS.current).cancel();
      }),
    [],
  );

  // per-frame sound triggers (footsteps, book pulled, book found)
  useEffect(() => {
    let raf = 0;
    let step = 0;
    let stage = 0;
    let lit = false;
    const loop = () => {
      if (rt.footstep !== step) {
        step = rt.footstep;
        audio.footstep((step % 2) * 0.3 - 0.15);
      }
      if (rt.book.stage !== stage) {
        if (rt.book.stage === 1) audio.pageRustle();
        stage = rt.book.stage;
      }
      const isLit = rt.book.highlight > 0.95;
      if (isLit && !lit) audio.chime();
      lit = isLit;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}
