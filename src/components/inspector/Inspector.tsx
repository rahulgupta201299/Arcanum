"use client";

import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { easing } from "maath";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { t } from "@/lib/i18n/strings";
import { SECTION_BY_KEY } from "@/lib/sections";
import type { Book } from "@/lib/types";
import { bookPalette, coverTexture, pagesTexture, spineTexture } from "@/lib/world/textures";
import { useLibrary } from "@/store/useLibrary";
import { bookDims } from "../world/FeaturedBook";

const SCALE = 4;

function titlePage(book: Book) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 768;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f3ead3";
  g.fillRect(0, 0, 512, 768);
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = `rgba(120,90,50,${Math.random() * 0.04})`;
    g.fillRect(Math.random() * 512, Math.random() * 768, 2, 2);
  }
  g.fillStyle = "#2a1d12";
  g.textAlign = "center";
  const serif = `Georgia, "Noto Serif Devanagari", serif`;
  g.font = `600 40px ${serif}`;
  const words = book.title.split(" ");
  let line = "";
  let y = 240;
  for (const w of words) {
    if (g.measureText(line + " " + w).width > 400) {
      g.fillText(line, 256, y);
      y += 50;
      line = w;
    } else line = line ? line + " " + w : w;
  }
  g.fillText(line, 256, y);
  g.font = `italic 26px ${serif}`;
  g.fillText(book.authors.join(", "), 256, y + 70);
  g.strokeStyle = "#8a6a3a";
  g.beginPath();
  g.moveTo(186, y + 110);
  g.lineTo(326, y + 110);
  g.stroke();
  g.font = `18px ${serif}`;
  g.fillText("Arcanum Edition", 256, 700);
  if (book.year) g.fillText(String(book.year > 0 ? book.year : `${-book.year} BCE`), 256, 726);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function BookModel({ book, open }: { book: Book; open: boolean }) {
  const hinge = useRef<THREE.Group>(null);
  const root = useRef<THREE.Group>(null);
  const d = bookDims(book);
  const W = d.w * SCALE,
    H = d.h * SCALE,
    D = d.d * SCALE;
  const cov = 0.022;
  const [extCover, setExtCover] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!book.coverUrl) return;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      book.coverUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        if (tex.image && (tex.image as HTMLImageElement).width > 40) setExtCover(tex);
      },
      undefined,
      () => {},
    );
  }, [book.coverUrl]);

  const m = useMemo(() => {
    const pal = bookPalette(book.id);
    const cloth = new THREE.MeshPhysicalMaterial({ color: pal.css, roughness: 0.6, sheen: 0.5, sheenColor: new THREE.Color("#ffffff") });
    const pages = new THREE.MeshStandardMaterial({ map: pagesTexture(), roughness: 0.95 });
    const paper = new THREE.MeshStandardMaterial({ color: "#efe5cc", roughness: 0.95 });
    const endpaper = new THREE.MeshStandardMaterial({ color: pal.css, roughness: 0.9 });
    return {
      cloth,
      pages,
      paper,
      endpaper,
      title: new THREE.MeshStandardMaterial({ map: titlePage(book), roughness: 0.95 }),
      spine: new THREE.MeshPhysicalMaterial({ map: spineTexture(book), roughness: 0.5, clearcoat: 0.3 }),
    };
  }, [book]);

  const coverMat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ map: extCover ?? coverTexture(book), roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.4 }),
    [extCover, book],
  );

  useFrame((state, dt) => {
    if (hinge.current) easing.damp(hinge.current.rotation, "y", open ? -2.4 : 0, 0.35, dt);
    if (root.current && !open) root.current.position.y = Math.sin(state.clock.elapsedTime * 1.2) * 0.02;
  });

  return (
    <group ref={root}>
      <group position={[0, -H / 2, 0]}>
        {/* back cover */}
        <mesh position={[-W / 2 + cov / 2, H / 2, 0]} material={[m.cloth, m.endpaper, m.cloth, m.cloth, m.cloth, m.cloth]} castShadow>
          <boxGeometry args={[cov, H, D]} />
        </mesh>
        {/* page block */}
        <mesh position={[0, H / 2, -0.012]} material={[m.title, m.paper, m.pages, m.pages, m.paper, m.pages]} castShadow>
          <boxGeometry args={[W - cov * 2, H * 0.965, D - 0.03]} />
        </mesh>
        {/* spine */}
        <mesh position={[0, H / 2, D / 2 - cov / 2]} material={[m.cloth, m.cloth, m.cloth, m.cloth, m.spine, m.cloth]} castShadow>
          <boxGeometry args={[W, H, cov]} />
        </mesh>
        {/* front cover on a hinge at the spine edge */}
        <group ref={hinge} position={[W / 2 - cov / 2, H / 2, D / 2]}>
          <mesh position={[0, 0, -D / 2]} material={[coverMat, m.endpaper, m.cloth, m.cloth, m.cloth, m.cloth]} castShadow>
            <boxGeometry args={[cov, H, D]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

export function Inspector() {
  const inspecting = useLibrary((s) => s.inspecting);
  const held = useLibrary((s) => s.heldBook);
  const lang = useLibrary((s) => s.lang);
  const setInspecting = useLibrary((s) => s.setInspecting);
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (!inspecting) setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setInspecting(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [inspecting, setInspecting]);

  if (!inspecting || !held) return null;
  return (
    <div className="inspector" role="dialog" aria-label={`Inspecting ${held.title}`}>
      <div className="inspector__stage">
        <Canvas key={key} shadows dpr={[1, 2]} camera={{ position: [2.1, 0.45, 2.5], fov: 35 }} gl={{ antialias: true }}>
          <color attach="background" args={["#0d0a08"]} />
          <ambientLight intensity={0.3} />
          <spotLight position={[3, 4, 3]} angle={0.5} penumbra={0.8} intensity={60} castShadow color="#ffe0b8" />
          <pointLight position={[-3, 1, -2]} intensity={8} color="#7aa0ff" />
          <Environment resolution={64}>
            <Lightformer form="rect" intensity={2} color="#ffd9a8" position={[2, 2, 3]} scale={[3, 3, 1]} />
            <Lightformer form="rect" intensity={0.8} color="#9bb8ff" position={[-3, 1, -2]} scale={[2, 4, 1]} />
          </Environment>
          <BookModel book={held} open={open} />
          <ContactShadows position={[0, -0.62, 0]} opacity={0.6} blur={2.4} scale={4} far={1.2} />
          <OrbitControls enablePan={false} minDistance={0.9} maxDistance={4.5} autoRotate={!open} autoRotateSpeed={0.8} enableDamping makeDefault />
        </Canvas>
        <div className="inspector__tools">
          <button className="btn btn--gold" onClick={() => setOpen((o) => !o)}>
            {open ? (lang === "hi" ? "बंद करें" : "Close cover") : lang === "hi" ? "किताब खोलें" : "Open cover"}
          </button>
          <button className="btn" onClick={() => setKey((k) => k + 1)}>
            {lang === "hi" ? "रीसेट" : "Reset view"}
          </button>
          <span className="muted small">{lang === "hi" ? "घुमाने के लिए खींचें · ज़ूम के लिए स्क्रॉल/पिंच" : "Drag to rotate · scroll / pinch to zoom"}</span>
        </div>
      </div>
      <div className="inspector__info">
        <button className="inspector__close" onClick={() => setInspecting(false)} aria-label={t("close", lang)}>
          ×
        </button>
        <div className="bookcard__eyebrow">{held.genres.map((g) => SECTION_BY_KEY.get(g)?.name[lang] ?? g).join(" · ")}</div>
        <h2 className="bookcard__title">{held.title}</h2>
        <div className="bookcard__author">{held.authors.join(", ")}</div>
        <div className="bookcard__meta">
          {held.year && <span>{held.year < 0 ? `${-held.year} BCE` : held.year}</span>}
          {held.pages && (
            <span>
              {held.pages} {t("pages", lang)}
            </span>
          )}
          {held.rating && <span>★ {held.rating.toFixed(1)}</span>}
          {held.isbn && <span>ISBN {held.isbn}</span>}
        </div>
        <p className="bookcard__desc bookcard__desc--full">{held.description}</p>
        {held.subjects.length > 0 && (
          <div className="why">
            {held.subjects.slice(0, 8).map((s) => (
              <span key={s} className="tag">
                {s}
              </span>
            ))}
          </div>
        )}
        <p className="muted small">{lang === "hi" ? "बातचीत जारी रखें — इस किताब के बारे में कुछ भी पूछें।" : "Keep talking — ask the librarian anything about this book."}</p>
      </div>
    </div>
  );
}
