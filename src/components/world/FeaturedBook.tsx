"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { ShelfLocation } from "@/lib/types";
import { LAYOUT, slotWorld } from "@/lib/world/layout";
import { rt } from "@/lib/world/runtime";
import { bookPalette, coverTexture, pagesTexture, spineTexture } from "@/lib/world/textures";
import { hash32 } from "@/lib/search/text";

export interface BookLike {
  id: string;
  title: string;
  authors: string[];
  pages?: number;
}

export function bookDims(b: { id: string; pages?: number }) {
  const h = 0.24 + (hash32(b.id) % 7) * 0.01;
  const thick = THREE.MathUtils.clamp(0.018 + (b.pages ?? 300) / 1000 * 0.045, 0.022, 0.054);
  return { w: thick, h, d: h * 0.68 };
}

/**
 * Six-material book: +x front cover, −x back cover, +z spine, −z fore-edge.
 * Local origin at the bottom-centre of the book.
 */
export function useBookMaterials(b: BookLike) {
  return useMemo(() => {
    const pal = bookPalette(b.id);
    const cloth = new THREE.MeshStandardMaterial({ color: pal.css, roughness: 0.65 });
    const pages = new THREE.MeshStandardMaterial({ map: pagesTexture(), roughness: 0.9 });
    const cover = new THREE.MeshStandardMaterial({ map: coverTexture(b), roughness: 0.55, emissive: new THREE.Color("#000") });
    const spine = new THREE.MeshStandardMaterial({ map: spineTexture(b), roughness: 0.55, emissive: new THREE.Color("#000") });
    return [cover, cloth, pages, pages, spine, pages];
  }, [b]);
}

/** Offset from shelf centre line to a front-aligned book's centre. */
export const bookFrontOffset = (depth: number) => LAYOUT.SHELF_DEPTH / 2 - depth / 2 - 0.012;

export const bookGeometry = (() => {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.translate(0, 0.5, 0);
  return g;
})();

/** Spine texture is 96×512 portrait; rotate UVs on the spine face so text runs bottom→top. */
export function BookMesh({ book, materials }: { book: BookLike; materials: THREE.Material[] }) {
  const d = bookDims(book);
  return <mesh geometry={bookGeometry} material={materials} scale={[d.w, d.h, d.d]} castShadow receiveShadow />;
}

/** A real catalogue book on a shelf; glows when the librarian is looking for it. */
export function FeaturedBook({ item, zOffset }: { item: { id: string; title: string; author: string; location: ShelfLocation }; zOffset: number }) {
  const book = useMemo(() => ({ id: item.id, title: item.title, authors: [item.author] }), [item]);
  const materials = useBookMaterials(book);
  const ref = useRef<THREE.Group>(null);
  const w = slotWorld(item.location);
  const d = bookDims(book);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const isTarget = rt.book.loc && rt.book.loc.section === item.location.section && rt.book.loc.row === item.location.row && rt.book.loc.bay === item.location.bay && rt.book.loc.shelf === item.location.shelf && rt.book.loc.slot === item.location.slot;
    g.visible = !(isTarget && rt.book.stage > 0);
    const glow = isTarget ? rt.book.highlight : 0;
    (materials[4] as THREE.MeshStandardMaterial).emissive.setRGB(glow * 0.9, glow * 0.6, glow * 0.25);
  });
  return (
    <group ref={ref} position={[w.x, w.y, w.z + zOffset + w.facing * bookFrontOffset(d.d)]} rotation-y={w.facing > 0 ? 0 : Math.PI}>
      <BookMesh book={book} materials={materials} />
    </group>
  );
}
