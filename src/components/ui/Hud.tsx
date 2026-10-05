"use client";

import { useEffect, useState } from "react";
import { gendered, t } from "@/lib/i18n/strings";
import { sectionFor } from "@/lib/sections";
import { rt } from "@/lib/world/runtime";
import { useLibrary, type Quality } from "@/store/useLibrary";

export function LangToggle() {
  const lang = useLibrary((s) => s.lang);
  const setLang = useLibrary((s) => s.setLang);
  return (
    <div className="seg" role="group" aria-label="Language">
      <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")} aria-pressed={lang === "en"}>
        EN
      </button>
      <button className={lang === "hi" ? "on" : ""} onClick={() => setLang("hi")} aria-pressed={lang === "hi"}>
        हि
      </button>
    </div>
  );
}

const Icon = {
  voice: (on: boolean) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      {on ? <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" /> : <path d="M17 9l5 6M22 9l-5 6" />}
    </svg>
  ),
  music: (on: boolean) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
      {!on && <path d="M3 3l18 18" />}
    </svg>
  ),
  walk: () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="13" cy="4" r="2" />
      <path d="M9 21l3-7 3 3v5M7 12l3-4 4 1 3 3" />
    </svg>
  ),
};

/** Where the user is: Foyer / Section N · name (updated from the render loop). */
function Location() {
  const lang = useLibrary((s) => s.lang);
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      const loc = rt.book.loc && (useLibrary.getState().phase === "fetching" || useLibrary.getState().phase === "presenting") ? rt.book.loc.section : rt.sectionUnderCamera;
      setSec(loc);
    }, 300);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="pill pill--loc">
      <span className="pill__dot" />
      {sec ? (
        <>
          <b>
            {t("section", lang)} {sec}
          </b>
          <span className="muted"> · {sectionFor(sec).name[lang]}</span>
        </>
      ) : (
        <b>{t("foyer", lang)}</b>
      )}
    </div>
  );
}

export function Status() {
  const s = useLibrary();
  const { lang, librarian, phase, target, speaking, listening } = s;
  let text = "";
  if (phase === "thinking" || s.pending) text = `${librarian.name} ${t("thinking", lang)}`;
  else if (phase === "walking" && target) text = `${librarian.name} ${t("walking", lang)} ${target.location.section}`;
  else if (phase === "fetching") text = `${librarian.name} ${t("fetching", lang)}`;
  else if (listening) text = t("listeningShort", lang);
  if (!text && !speaking) return null;
  return (
    <div className="status" role="status" aria-live="polite">
      {speaking && !text ? (
        <span className="wave" aria-label="speaking">
          <i />
          <i />
          <i />
          <i />
        </span>
      ) : (
        <span className="spinner" />
      )}
      <span>{gendered(text || librarian.name, lang, librarian.gender)}</span>
    </div>
  );
}

export function Hud() {
  const phase = useLibrary((s) => s.phase);
  const voiceOn = useLibrary((s) => s.voiceOn);
  const soundOn = useLibrary((s) => s.soundOn);
  const quality = useLibrary((s) => s.quality);
  const explore = useLibrary((s) => s.explore);
  const provider = useLibrary((s) => s.provider);
  const accent = useLibrary((s) => s.accent);
  const lang = useLibrary((s) => s.lang);
  const set = useLibrary((s) => s.set);
  if (phase === "gate") return null;
  const canExplore = phase === "idle" || phase === "presenting";
  return (
    <header className="hud">
      <div className="hud__left">
        <div className="brand">Arcanum</div>
        <Location />
      </div>
      <div className="hud__right">
        {provider && (
          <span className="pill pill--ai" title="Active language model provider">
            AI · {provider === "rules" ? "offline NLU" : provider}
          </span>
        )}
        <LangToggle />
        <button className={`icon-btn ${voiceOn ? "on" : ""}`} onClick={() => set("voiceOn", !voiceOn)} aria-label="Toggle librarian voice" title="Librarian voice">
          {Icon.voice(voiceOn)}
        </button>
        <button className={`icon-btn ${soundOn ? "on" : ""}`} onClick={() => set("soundOn", !soundOn)} aria-label="Toggle ambience" title="Ambient sound">
          {Icon.music(soundOn)}
        </button>
        <button
          className={`icon-btn ${explore ? "on" : ""}`}
          disabled={!canExplore && !explore}
          onClick={() => set("explore", !explore)}
          aria-label="Explore freely"
          title={t("exploreHint", lang)}
        >
          {Icon.walk()}
        </button>
        <select className="quality quality--accent" value={accent} onChange={(e) => set("accent", e.target.value as "in" | "gb")} aria-label="English accent" title="Librarian's English accent">
          <option value="in">EN · India</option>
          <option value="gb">EN · UK</option>
        </select>
        <select className="quality" value={quality} onChange={(e) => set("quality", e.target.value as Quality)} aria-label="Graphics quality">
          <option value="high">HQ</option>
          <option value="medium">MQ</option>
          <option value="low">LQ</option>
        </select>
      </div>
      {explore && <div className="explore-hint">{t("exploreHint", lang)}</div>}
    </header>
  );
}
