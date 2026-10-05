"use client";

import { create } from "zustand";
import type { Book, ChatResponse, Intent, Lang, SearchHit, SectionId } from "@/lib/types";

export type Phase =
  | "gate" // outside, doors closed
  | "opening" // doors swinging open
  | "entering" // cinematic dolly into the foyer
  | "greeting" // librarian welcomes the user
  | "idle" // conversation
  | "thinking" // librarian is understanding / searching
  | "walking" // walking to a section
  | "fetching" // at the shelf: scan, reach, pull
  | "presenting"; // holding the book out to the user

export type Gender = "female" | "male";

export interface Msg {
  id: number;
  role: "user" | "librarian";
  text: string;
  lang: Lang;
}

export type Quality = "low" | "medium" | "high";

interface LibraryState {
  phase: Phase;
  lang: Lang;
  librarian: { gender: Gender; name: string };
  messages: Msg[];
  pending: boolean;
  results: SearchHit[];
  /** suggestions shown as cards (the librarian does not walk until one is picked) */
  recs: SearchHit[];
  recsBestsellers: boolean;
  /** follow-up quick replies from the librarian */
  chips: string[];
  lastIntent: Intent | null;
  lastSearch: ChatResponse["search"];
  target: SearchHit | null;
  /** increments every time the librarian must go fetch `target` */
  fetchNonce: number;
  /** section to walk to without fetching a book */
  goSection: { id: SectionId; nonce: number } | null;
  heldBook: Book | null;
  inspecting: boolean;
  voiceOn: boolean;
  soundOn: boolean;
  listening: boolean;
  speaking: boolean;
  quality: Quality;
  provider: string;
  status: string;
  explore: boolean;
  /** English voice accent: Indian (default) or British */
  accent: "in" | "gb";
  /** rigged GLB avatars available under /public/models */
  models: { female: boolean; male: boolean };

  setPhase(p: Phase): void;
  setLang(l: Lang): void;
  enter(): void;
  say(text: string, lang?: Lang): void;
  send(text: string): Promise<void>;
  fetchHit(hit: SearchHit): void;
  setHeld(b: Book | null): void;
  setInspecting(v: boolean): void;
  set<K extends keyof LibraryState>(k: K, v: LibraryState[K]): void;
}

const NAMES: Record<Gender, string[]> = {
  female: ["Meera", "Asha", "Clara", "Ananya", "Sophia"],
  male: ["Arjun", "Vikram", "Henry", "Rohan", "Elias"],
};

function pickLibrarian() {
  const gender: Gender = Math.random() < 0.5 ? "female" : "male";
  const list = NAMES[gender];
  return { gender, name: list[Math.floor(Math.random() * list.length)] };
}

let msgId = 0;

/** Server templates are written in the feminine voice; adapt Hindi verb forms for a male librarian. */
function toMasculineHindi(t: string) {
  return t.replace(/ती हूँ/g, "ता हूँ").replace(/ूँगी/g, "ूँगा").replace(/आपकी लाइब्रेरियन/g, "आपका लाइब्रेरियन");
}

export const useLibrary = create<LibraryState>((set, get) => ({
  phase: "gate",
  lang: "en",
  librarian: { gender: "female", name: "Meera" },
  messages: [],
  pending: false,
  results: [],
  recs: [],
  recsBestsellers: false,
  chips: [],
  lastIntent: null,
  lastSearch: null,
  target: null,
  fetchNonce: 0,
  goSection: null,
  heldBook: null,
  inspecting: false,
  voiceOn: true,
  soundOn: true,
  listening: false,
  speaking: false,
  quality: "high",
  provider: "",
  status: "",
  explore: false,
  accent: "in",
  models: { female: false, male: false },

  setPhase: (phase) => set({ phase }),
  setLang: (lang) => set({ lang }),
  set: (k, v) => set({ [k]: v } as Partial<LibraryState>),

  enter() {
    set({ librarian: pickLibrarian(), phase: "opening" });
  },

  say(raw, lang) {
    const text = get().librarian.gender === "male" ? toMasculineHindi(raw) : raw;
    set((s) => ({ messages: [...s.messages, { id: ++msgId, role: "librarian", text, lang: lang ?? s.lang }] }));
  },

  async send(text) {
    const s = get();
    const clean = text.trim();
    if (!clean || s.pending) return;
    set({
      messages: [...s.messages, { id: ++msgId, role: "user", text: clean, lang: s.lang }],
      pending: true,
      explore: false,
      status: "thinking",
    });
    const busy = s.phase === "walking" || s.phase === "fetching";
    if (!busy) set({ phase: "thinking" });
    try {
      const body = JSON.stringify({
          message: clean,
          lang: s.lang,
          history: s.messages.slice(-10).map((m) => ({ role: m.role, text: m.text })),
          currentBook: s.heldBook ?? s.target?.book ?? null,
          librarianName: s.librarian.name,
          librarianGender: s.librarian.gender,
          lastIntent: s.lastIntent,
          lastSearch: s.lastSearch,
        });
      // one automatic retry: covers dev-server reloads and brief network blips
      let data: ChatResponse | null = null;
      for (let attempt = 0; attempt < 2 && !data; attempt++) {
        try {
          const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body });
          if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
          data = (await res.json()) as ChatResponse;
        } catch (e) {
          console.error("[Arcanum] /api/chat failed", e);
          if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
          else throw e;
        }
      }
      if (!data) throw new Error("no response");
      const after = get();
      set({ provider: data.provider, pending: false, status: "", lang: data.lang });
      get().say(data.reply, data.lang);
      set({ chips: data.suggestions ?? [], lastIntent: data.intent, ...(data.search !== undefined ? { lastSearch: data.search } : {}) });
      if (data.target) {
        set({ results: data.results ?? [], recs: [], target: data.target, fetchNonce: after.fetchNonce + 1 });
      } else if (data.results?.length && (data.intent === "recommend_list" || data.intent === "general_question")) {
        set({ recs: data.results, recsBestsellers: data.results.every((r) => r.why.includes("bestseller")) });
        if (get().phase === "thinking") set({ phase: get().heldBook ? "presenting" : "idle" });
      } else if (data.section) {
        set({ goSection: { id: data.section, nonce: (after.goSection?.nonce ?? 0) + 1 } });
      } else if (get().phase === "thinking") {
        set({ phase: get().heldBook ? "presenting" : "idle" });
      }
    } catch {
      const l = get().lang;
      set({ pending: false, status: "" });
      get().say(l === "hi" ? "क्षमा कीजिए — अभी कैटलॉग से जुड़ नहीं पाई। कृपया एक पल बाद फिर कोशिश कीजिए।" : "Sorry — I couldn't reach the catalogue just now. Please try again in a moment.", l);
      if (get().phase === "thinking") set({ phase: get().heldBook ? "presenting" : "idle" });
    }
  },

  fetchHit(hit) {
    const s = get();
    if (s.phase === "walking" || s.phase === "fetching") return;
    const line =
      s.lang === "hi"
        ? `ज़रूर, "${hit.book.title}" सेक्शन ${hit.location.section} में है। चलिए, मैं लेकर आती हूँ।`
        : `Of course — "${hit.book.title}" is in Section ${hit.location.section}. Let me get it for you.`;
    s.say(line);
    const results = s.recs.length ? [hit, ...s.recs.filter((r) => r.book.id !== hit.book.id)] : s.results;
    set({ target: hit, results, recs: [], chips: [], lastIntent: "find_book", fetchNonce: s.fetchNonce + 1 });
  },

  setHeld: (heldBook) => set({ heldBook }),
  setInspecting: (inspecting) => set({ inspecting }),
}));

export function greetingFor(lang: Lang, name: string, gender: Gender) {
  if (lang === "hi")
    return `Arcanum में आपका स्वागत है! मैं ${name} हूँ, आपकी लाइब्रेरियन। यहाँ दुनिया की हर किताब का एक घर है। मुझे आपके बारे में जानना अच्छा लगेगा — आपको क्या पढ़ना पसंद है? या कुछ भी पूछिए, बेझिझक।`.replace(
      "आपकी लाइब्रेरियन",
      gender === "male" ? "आपका लाइब्रेरियन" : "आपकी लाइब्रेरियन",
    );
  return `Welcome to Arcanum! I'm ${name}, your librarian. Every book ever written has a home on these shelves. I'd love to get to know you a little — what do you enjoy reading? Or ask me anything at all.`;
}
