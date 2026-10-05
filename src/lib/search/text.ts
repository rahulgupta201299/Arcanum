// Text utilities shared by the lexical index, local embedder and rule-based NLU.

const STOP = new Set(
  "a an the of and or to in on for with about from by is are was were be been i me my we you your it its this that these those some any book books novel read reading want need looking find show give get please can could would like something kind type story stories one which who what me mujhe chahiye koi ek kitab kitaab ki ka ke hai ho do de dikhao batao chahta chahti hoon hu ko se par mein me aur ya bhi wala wali waali vaali"
    .split(" "),
);

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[“”"'’‘`]/g, "")
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(s: string, keepStop = false): string[] {
  return normalize(s)
    .split(/[\s-]+/)
    .filter((t) => t.length > 1 && (keepStop || !STOP.has(t)));
}

/** Light suffix stripping so "habits"≈"habit", "programming"≈"program". */
export function stem(t: string): string {
  if (!/^[a-z]+$/.test(t) || t.length < 5) return t;
  return t.replace(/(ingly|edly|ing|ies|ied|ers|er|ed|es|s)$/, (m) => (m === "ies" || m === "ied" ? "y" : ""));
}

export function terms(s: string): string[] {
  return tokenize(s).map(stem);
}

/** FNV-1a 32-bit — stable across server and client. */
export function hash32(str: string, seed = 2166136261): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic PRNG (mulberry32) for procedural content. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function detectLang(s: string): "en" | "hi" {
  if (/[ऀ-ॿ]/.test(s)) return "hi";
  const hinglish = /\b(mujhe|chahiye|kitab|kitaab|kya|hai|hain|aap|batao|dikhao|kaun|kaise|kahan|accha|acha|namaste|dhanyavaad|shukriya|wala|wali|koi|ek|aur|kuch|mera|meri|chahta|chahti|padhna|padhni)\b/i;
  return hinglish.test(s) ? "hi" : "en";
}
