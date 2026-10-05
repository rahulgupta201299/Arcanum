"use client";

import type { Lang } from "../types";

/**
 * Voice layer with swappable providers.
 *  STT: Web Speech API (Chrome/Edge/Safari) — swap for Whisper/Deepgram by implementing STTProvider.
 *  TTS: browser speechSynthesis, or server TTS (/api/tts, e.g. OpenAI) when enabled.
 */
export interface STTHandlers {
  onPartial(t: string): void;
  onFinal(t: string): void;
  onEnd(): void;
  onError(e: string): void;
}

export interface STTOptions {
  /** how long the user may pause (ms) before we treat the sentence as finished */
  silenceMs?: number;
  /** give up if nothing at all is said within this time (ms) */
  noSpeechMs?: number;
  /** hard cap on one utterance (ms) */
  maxMs?: number;
}

export interface STTProvider {
  readonly supported: boolean;
  start(lang: Lang, handlers: STTHandlers, opts?: STTOptions): void;
  /** stop listening and submit what was heard so far */
  stop(): void;
}

export interface SpeakHandlers {
  onStart?(): void;
  onBoundary?(): void;
  onEnd?(): void;
}

export interface TTSProvider {
  readonly name: string;
  speak(text: string, lang: Lang, gender: "male" | "female", h?: SpeakHandlers): Promise<void>;
  cancel(): void;
}

const LOCALE: Record<Lang, string> = { en: "en-IN", hi: "hi-IN" };

// ------------------------------------------------------------------ STT
type SR = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
};

/**
 * Patient speech capture: runs the recogniser in continuous mode, keeps the
 * transcript across the browser's automatic restarts, and only finishes after
 * the speaker has been silent for `silenceMs` (default 2.2 s) — so natural
 * pauses mid-sentence don't cut you off.
 */
export class WebSpeechSTT implements STTProvider {
  private rec: SR | null = null;
  private session: { done: boolean; finish: () => void } | null = null;

  get supported() {
    return typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  start(lang: Lang, h: STTHandlers, opts: STTOptions = {}) {
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) return h.onError("unsupported");
    this.abort();
    const silenceMs = opts.silenceMs ?? 2200;
    const noSpeechMs = opts.noSpeechMs ?? 8000;
    const maxMs = opts.maxMs ?? 60000;
    const t0 = Date.now();
    let committed = ""; // finalised text from earlier recogniser sessions / results
    let interim = "";
    let timer: ReturnType<typeof setTimeout> | null = null;

    const session = {
      done: false,
      finish: () => {
        if (session.done) return;
        session.done = true;
        if (timer) clearTimeout(timer);
        try {
          this.rec?.stop();
        } catch {}
        this.rec = null;
        const text = (committed + " " + interim).replace(/\s+/g, " ").trim();
        if (text) h.onFinal(text);
        h.onEnd();
      },
    };
    this.session = session;

    const arm = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(session.finish, ms);
    };
    arm(noSpeechMs);

    const launch = () => {
      const rec: SR = new Ctor();
      rec.lang = LOCALE[lang];
      rec.interimResults = true;
      rec.continuous = true;
      rec.maxAlternatives = 1;
      let sessionFinal = "";
      rec.onresult = (e) => {
        let live = "";
        sessionFinal = "";
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) sessionFinal += r[0].transcript + " ";
          else live += r[0].transcript;
        }
        interim = (sessionFinal + live).trim();
        h.onPartial((committed + " " + interim).trim());
        if (Date.now() - t0 > maxMs) return session.finish();
        arm(silenceMs); // every new word resets the pause timer
      };
      rec.onerror = (e) => {
        if (e.error === "no-speech" || e.error === "aborted") return; // handled by our own timers / restarts
        session.done = true;
        if (timer) clearTimeout(timer);
        h.onError(e.error);
        h.onEnd();
      };
      rec.onend = () => {
        // the browser ended this recogniser (Safari/Chrome do this on short pauses) — keep listening
        committed = (committed + " " + interim).trim();
        interim = "";
        if (session.done) return;
        if (Date.now() - t0 > maxMs) return session.finish();
        try {
          launch();
        } catch {
          session.finish();
        }
      };
      this.rec = rec;
      rec.start();
    };
    launch();
  }

  stop() {
    this.session?.finish();
  }

  private abort() {
    if (this.session) this.session.done = true;
    try {
      this.rec?.stop();
    } catch {}
    this.rec = null;
  }
}

// ------------------------------------------------------------------ TTS
const FEMALE_HINT = /female|woman|samantha|zira|veena|lekha|heera|kalpana|swara|neerja|aditi|raveena|karen|moira|tessa|susan|victoria|fiona|serena|google (हिन्दी|uk english female|us english)|aria|jenny|ava|allison/i;
const MALE_HINT = /\bmale|\bman\b|rishi|hemant|prabhat|madhur|ravi|daniel|david|alex|fred|thomas|oliver|guy|arthur|aaron|google uk english male/i;

export class BrowserTTS implements TTSProvider {
  readonly name = "browser";
  private voices: SpeechSynthesisVoice[] = [];
  constructor() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () => (this.voices = window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }
  pick(lang: Lang, gender: "male" | "female") {
    const want = LOCALE[lang].slice(0, 2);
    const byLang = this.voices.filter((v) => v.lang.toLowerCase().startsWith(want));
    const pool = byLang.length ? byLang : this.voices.filter((v) => v.lang.startsWith("en"));
    const hint = gender === "female" ? FEMALE_HINT : MALE_HINT;
    const anti = gender === "female" ? MALE_HINT : FEMALE_HINT;
    const score = (v: SpeechSynthesisVoice) =>
      (hint.test(v.name) ? 4 : 0) - (anti.test(v.name) ? 4 : 0) + (v.lang.toLowerCase() === LOCALE[lang].toLowerCase() ? 2 : 0) + (/natural|neural|premium|enhanced|google/i.test(v.name) ? 1 : 0) + (v.localService ? 0 : 0.5);
    return [...pool].sort((a, b) => score(b) - score(a))[0] ?? null;
  }
  speak(text: string, lang: Lang, gender: "male" | "female", h: SpeakHandlers = {}) {
    return new Promise<void>((resolve) => {
      const ss = typeof window !== "undefined" ? window.speechSynthesis : null;
      if (!ss) {
        h.onEnd?.();
        return resolve();
      }
      ss.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = this.pick(lang, gender);
      if (v) u.voice = v;
      u.lang = v?.lang ?? LOCALE[lang];
      // no gendered voice available → shift pitch so the voice still matches the avatar
      const genderMatch = v && (gender === "female" ? FEMALE_HINT : MALE_HINT).test(v.name);
      u.pitch = genderMatch ? 1 : gender === "female" ? 1.15 : 0.82;
      u.rate = lang === "hi" ? 0.95 : 1.0;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearInterval(keepAlive);
        h.onEnd?.();
        resolve();
      };
      u.onstart = () => h.onStart?.();
      u.onboundary = () => h.onBoundary?.();
      u.onend = finish;
      u.onerror = finish;
      // Chrome stops long utterances after ~15s unless nudged
      const keepAlive = setInterval(() => {
        if (!ss.speaking) return;
        ss.pause();
        ss.resume();
      }, 10000);
      ss.speak(u);
      // safety net if the engine never fires events
      setTimeout(finish, Math.max(4000, text.length * 110));
    });
  }
  cancel() {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }
}

export class ServerTTS implements TTSProvider {
  readonly name = "server";
  private audio: HTMLAudioElement | null = null;
  constructor(private fallback: TTSProvider) {}
  async speak(text: string, lang: Lang, gender: "male" | "female", h: SpeakHandlers = {}) {
    try {
      const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, lang, gender }) });
      if (!res.ok) throw new Error("tts");
      const url = URL.createObjectURL(await res.blob());
      this.cancel();
      const a = new Audio(url);
      this.audio = a;
      await new Promise<void>((resolve) => {
        a.onplay = () => h.onStart?.();
        a.onended = a.onerror = () => {
          h.onEnd?.();
          URL.revokeObjectURL(url);
          resolve();
        };
        a.play().catch(() => {
          h.onEnd?.();
          resolve();
        });
      });
    } catch {
      return this.fallback.speak(text, lang, gender, h);
    }
  }
  cancel() {
    this.audio?.pause();
    this.audio = null;
    this.fallback.cancel();
  }
}

let tts: TTSProvider | null = null;
let stt: STTProvider | null = null;
export function getTTS(serverAvailable: boolean): TTSProvider {
  if (!tts || (serverAvailable && tts.name !== "server")) {
    const browser = new BrowserTTS();
    tts = serverAvailable ? new ServerTTS(browser) : browser;
  }
  return tts;
}
export function getSTT(): STTProvider {
  return (stt ??= new WebSpeechSTT());
}
