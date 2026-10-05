"use client";

import * as THREE from "three";
import { hash32, rng } from "../search/text";

/**
 * Procedural canvas textures — no texture downloads, instant start, and
 * Devanagari renders with the system font. All results are cached.
 */
const cache = new Map<string, THREE.Texture>();

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

function finish(c: HTMLCanvasElement, opts: { repeat?: [number, number]; srgb?: boolean; aniso?: number } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = opts.aniso ?? 8;
  if (opts.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...opts.repeat);
  }
  t.needsUpdate = true;
  return t;
}

function memo<T extends THREE.Texture>(key: string, make: () => T): T {
  let t = cache.get(key) as T | undefined;
  if (!t) cache.set(key, (t = make()));
  return t;
}

/** Dark walnut wood grain. */
export function woodTexture(tone = "#4a2c17", key = "wood") {
  return memo(`${key}:${tone}`, () => {
    const [c, g] = canvas(512, 512);
    g.fillStyle = tone;
    g.fillRect(0, 0, 512, 512);
    const r = rng(hash32(key));
    for (let i = 0; i < 160; i++) {
      const y = r() * 512;
      g.strokeStyle = `rgba(${r() < 0.5 ? "20,10,4" : "120,80,45"},${0.06 + r() * 0.12})`;
      g.lineWidth = 0.5 + r() * 2.5;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x * 0.01 + i) * (2 + r() * 5));
      g.stroke();
    }
    return finish(c, { repeat: [1, 1] });
  });
}

/** Herringbone-ish parquet floor. */
export function parquetTexture() {
  return memo("parquet", () => {
    const [c, g] = canvas(1024, 1024);
    const r = rng(7);
    const pw = 64,
      ph = 256;
    for (let y = -ph; y < 1024 + ph; y += ph / 2) {
      for (let x = 0; x < 1024; x += pw) {
        const off = ((x / pw) % 2) * (ph / 2);
        const l = 30 + r() * 14;
        g.fillStyle = `hsl(${24 + r() * 8}, ${45 + r() * 10}%, ${l}%)`;
        g.fillRect(x, y + off, pw - 2, ph / 2 - 2);
        for (let k = 0; k < 6; k++) {
          g.strokeStyle = `rgba(30,15,5,${0.08 + r() * 0.1})`;
          g.beginPath();
          const gx = x + r() * pw;
          g.moveTo(gx, y + off);
          g.lineTo(gx + (r() - 0.5) * 6, y + off + ph / 2);
          g.stroke();
        }
      }
    }
    return finish(c, { repeat: [6, 6] });
  });
}

/** Subtle plaster / stone wall. */
export function plasterTexture(base = "#d9cbb3") {
  return memo(`plaster:${base}`, () => {
    const [c, g] = canvas(512, 512);
    g.fillStyle = base;
    g.fillRect(0, 0, 512, 512);
    const r = rng(11);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "255,255,255"},${r() * 0.04})`;
      g.fillRect(r() * 512, r() * 512, 2 + r() * 3, 2 + r() * 3);
    }
    return finish(c, { repeat: [4, 2] });
  });
}

/** Neutral spine detail (bands + wear) — tinted per-instance by instanceColor. */
export function spineDetailTexture() {
  return memo("spine-detail", () => {
    const [c, g] = canvas(64, 256);
    g.fillStyle = "#e8e2d6";
    g.fillRect(0, 0, 64, 256);
    const r = rng(3);
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(0,0,0,${r() * 0.05})`;
      g.fillRect(r() * 64, r() * 256, 2, 2);
    }
    g.fillStyle = "#fff6d8";
    for (const y of [22, 30, 226, 234]) g.fillRect(4, y, 56, 3);
    g.fillStyle = "rgba(255,246,216,0.85)";
    g.fillRect(14, 80, 36, 90);
    g.fillStyle = "rgba(0,0,0,0.25)";
    for (let i = 0; i < 6; i++) g.fillRect(20, 92 + i * 12, 24 - (i % 3) * 5, 3);
    return finish(c);
  });
}

export function bookPalette(id: string) {
  const r = rng(hash32(id));
  const hues = [0, 8, 20, 35, 140, 160, 200, 215, 230, 270, 330, 350];
  const h = hues[Math.floor(r() * hues.length)] + r() * 10;
  const s = 30 + r() * 40;
  const l = 18 + r() * 22;
  return { h, s, l, css: `hsl(${h},${s}%,${l}%)`, accent: `hsl(${(h + 40) % 360},70%,72%)` };
}

function wrapText(g: CanvasRenderingContext2D, text: string, maxW: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (g.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

const SERIF = `"Cormorant Garamond", "Playfair Display", Georgia, "Noto Serif Devanagari", "Times New Roman", serif`;

/** Full front cover with title, author and ornament. */
export function coverTexture(book: { id: string; title: string; authors: string[] }) {
  return memo(`cover:${book.id}`, () => {
    const [c, g] = canvas(512, 768);
    const p = bookPalette(book.id);
    const grad = g.createLinearGradient(0, 0, 512, 768);
    grad.addColorStop(0, `hsl(${p.h},${p.s}%,${p.l + 8}%)`);
    grad.addColorStop(1, `hsl(${p.h},${p.s}%,${Math.max(6, p.l - 8)}%)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 768);
    // cloth weave
    const r = rng(hash32(book.id) + 1);
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = `rgba(255,255,255,${r() * 0.035})`;
      g.fillRect(r() * 512, r() * 768, 1, 3);
    }
    g.strokeStyle = p.accent;
    g.lineWidth = 4;
    g.strokeRect(28, 28, 456, 712);
    g.lineWidth = 1.5;
    g.strokeRect(40, 40, 432, 688);
    // ornament
    g.save();
    g.translate(256, 520);
    g.strokeStyle = p.accent;
    g.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      g.rotate(Math.PI / 6);
      g.beginPath();
      g.ellipse(0, 26, 8, 26, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.beginPath();
    g.arc(0, 0, 62, 0, Math.PI * 2);
    g.stroke();
    g.restore();
    g.fillStyle = "#f5ecd7";
    g.textAlign = "center";
    g.textBaseline = "middle";
    let size = 56;
    g.font = `600 ${size}px ${SERIF}`;
    let lines = wrapText(g, book.title, 400);
    while (lines.length > 4 && size > 30) {
      size -= 6;
      g.font = `600 ${size}px ${SERIF}`;
      lines = wrapText(g, book.title, 400);
    }
    lines.slice(0, 5).forEach((l, i) => g.fillText(l, 256, 140 + i * size * 1.15));
    g.font = `italic 30px ${SERIF}`;
    g.fillStyle = p.accent;
    g.fillText(book.authors.slice(0, 2).join(" & "), 256, 680);
    return finish(c);
  });
}

/** Spine with vertical title for featured (real catalogue) books. */
export function spineTexture(book: { id: string; title: string; authors: string[] }) {
  return memo(`spine:${book.id}`, () => {
    const [c, g] = canvas(96, 512);
    const p = bookPalette(book.id);
    g.fillStyle = p.css;
    g.fillRect(0, 0, 96, 512);
    g.fillStyle = p.accent;
    for (const y of [20, 30, 482, 492]) g.fillRect(6, y, 84, 3);
    g.save();
    g.translate(48, 256);
    g.rotate(-Math.PI / 2);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#f6edd6";
    let size = 34;
    g.font = `600 ${size}px ${SERIF}`;
    const title = book.title.length > 34 ? book.title.slice(0, 32) + "…" : book.title;
    while (g.measureText(title).width > 400 && size > 16) g.font = `600 ${(size -= 2)}px ${SERIF}`;
    g.fillText(title, 0, -10);
    g.font = `italic 20px ${SERIF}`;
    g.fillStyle = p.accent;
    g.fillText(book.authors[0] ?? "", 0, 24);
    g.restore();
    return finish(c);
  });
}

/** Page-edge texture (stacked paper). */
export function pagesTexture() {
  return memo("pages", () => {
    const [c, g] = canvas(256, 64);
    g.fillStyle = "#efe6cf";
    g.fillRect(0, 0, 256, 64);
    for (let y = 0; y < 64; y += 2) {
      g.fillStyle = `rgba(120,100,70,${0.08 + (y % 6 === 0 ? 0.08 : 0)})`;
      g.fillRect(0, y, 256, 1);
    }
    return finish(c);
  });
}

/** Signage text (section signs, plaques). */
export function signTexture(lines: { text: string; size: number; color?: string; weight?: number; italic?: boolean }[], w = 1024, h = 256, bg = "#1b120b", border = "#c9a45c") {
  const key = `sign:${w}x${h}:${bg}:${lines.map((l) => l.text + l.size).join("|")}`;
  return memo(key, () => {
    const [c, g] = canvas(w, h);
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = border;
    g.lineWidth = 6;
    g.strokeRect(10, 10, w - 20, h - 20);
    g.lineWidth = 2;
    g.strokeRect(22, 22, w - 44, h - 44);
    g.textAlign = "center";
    g.textBaseline = "middle";
    const total = lines.reduce((a, l) => a + l.size * 1.2, 0);
    let y = h / 2 - total / 2;
    for (const l of lines) {
      g.font = `${l.italic ? "italic " : ""}${l.weight ?? 600} ${l.size}px ${SERIF}`;
      g.fillStyle = l.color ?? "#f1dca6";
      y += (l.size * 1.2) / 2;
      g.fillText(l.text, w / 2, y, w - 80);
      y += (l.size * 1.2) / 2;
    }
    return finish(c);
  });
}

/** A "wall of spines" used for far LOD of a bookshelf row. */
export function spineWallTexture(seed: number) {
  return memo(`spinewall:${seed % 6}`, () => {
    const [c, g] = canvas(512, 512);
    g.fillStyle = "#1a0f08";
    g.fillRect(0, 0, 512, 512);
    const r = rng(seed % 6);
    const rows = 5;
    for (let s = 0; s < rows; s++) {
      const y0 = s * (512 / rows);
      let x = 4;
      while (x < 508) {
        const w = 6 + r() * 10;
        const hgt = (512 / rows) * (0.62 + r() * 0.3);
        g.fillStyle = `hsl(${[0, 20, 35, 150, 210, 230, 350][Math.floor(r() * 7)]},${30 + r() * 40}%,${15 + r() * 25}%)`;
        g.fillRect(x, y0 + (512 / rows) - hgt - 8, w - 1, hgt);
        x += w;
      }
      g.fillStyle = "#3b2414";
      g.fillRect(0, y0 + 512 / rows - 8, 512, 8);
    }
    return finish(c);
  });
}

/** Radial glow sprite for lamps. */
export function glowTexture() {
  return memo("glow", () => {
    const [c, g] = canvas(128, 128);
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,220,160,1)");
    grad.addColorStop(0.25, "rgba(255,190,110,0.45)");
    grad.addColorStop(1, "rgba(255,170,80,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return finish(c);
  });
}

/** Strand texture for hair: fine vertical streaks with highlights. */
export function hairTexture(base: string) {
  return memo(`hair:${base}`, () => {
    const [c, g] = canvas(256, 256);
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    const r = rng(hash32(base));
    for (let i = 0; i < 900; i++) {
      const x = r() * 256;
      const light = r() < 0.35;
      g.strokeStyle = light ? `rgba(255,225,190,${0.05 + r() * 0.1})` : `rgba(0,0,0,${0.08 + r() * 0.15})`;
      g.lineWidth = 0.5 + r() * 1.2;
      g.beginPath();
      g.moveTo(x, 0);
      g.bezierCurveTo(x + (r() - 0.5) * 12, 85, x + (r() - 0.5) * 12, 170, x + (r() - 0.5) * 8, 256);
      g.stroke();
    }
    const t = finish(c, { repeat: [3, 1] });
    return t;
  });
}
