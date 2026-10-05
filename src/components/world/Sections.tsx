"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { sectionFor } from "@/lib/sections";
import { hash32, rng } from "@/lib/search/text";
import type { SectionId, ShelfLocation } from "@/lib/types";
import { LAYOUT, rowGeometry, sectionPairAt, sectionSide, sectionZ, shelfY, slotIndex, slotU, uToX } from "@/lib/world/layout";
import { rt } from "@/lib/world/runtime";
import { bookPalette, glowTexture, signTexture, spineDetailTexture, spineWallTexture } from "@/lib/world/textures";
import { useLibrary } from "@/store/useLibrary";
import { FeaturedBook } from "./FeaturedBook";
import { mats } from "./materials";

const L = LAYOUT;
const ROW_LEN = L.BAY_MARGIN + L.BAYS * L.BAY_WIDTH;

// ---------------------------------------------------------------- geometry
const shelvingCache = new Map<number, THREE.BufferGeometry>();

/** All shelving for one section (both rows), merged into a single geometry. zc = 0. */
function shelvingGeometry(side: -1 | 1): THREE.BufferGeometry {
  const cached = shelvingCache.get(side);
  if (cached) return cached;
  const parts: THREE.BufferGeometry[] = [];
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    parts.push(g);
  };
  const fakeSection = side === -1 ? 1 : 2; // only used for side
  for (const row of [0, 1] as const) {
    const { centerZ, zc, facing } = rowGeometry(fakeSection, row);
    const cz = centerZ - zc;
    const backZ = cz - facing * (L.SHELF_DEPTH / 2 - 0.01);
    const midU = L.BAY_MARGIN + (L.BAYS * L.BAY_WIDTH) / 2;
    const midX = side * (L.MAIN_HALF + midU);
    const totalW = L.BAYS * L.BAY_WIDTH;
    // back panel, plinth, cornice
    box(totalW, L.SHELF_HEIGHT, 0.03, midX, L.SHELF_HEIGHT / 2, backZ);
    box(totalW + 0.06, 0.12, L.SHELF_DEPTH + 0.02, midX, 0.06, cz);
    box(totalW + 0.16, 0.1, L.SHELF_DEPTH + 0.12, midX, L.SHELF_HEIGHT + 0.05, cz + facing * 0.03);
    box(totalW + 0.1, 0.06, L.SHELF_DEPTH + 0.06, midX, L.SHELF_HEIGHT - 0.02, cz);
    // vertical dividers
    for (let b = 0; b <= L.BAYS; b++) {
      const u = L.BAY_MARGIN + b * L.BAY_WIDTH;
      box(0.05, L.SHELF_HEIGHT, L.SHELF_DEPTH, side * (L.MAIN_HALF + u), L.SHELF_HEIGHT / 2, cz);
    }
    // shelf boards
    for (let s = 0; s < L.SHELVES; s++) {
      box(totalW, 0.028, L.SHELF_DEPTH - 0.02, midX, shelfY(s) - 0.014, cz);
    }
  }
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  shelvingCache.set(side, merged);
  return merged;
}

// ---------------------------------------------------------------- books
const unitBox = new THREE.BoxGeometry(1, 1, 1);

interface Featured {
  id: string;
  title: string;
  author: string;
  location: ShelfLocation;
}

function useInstancedBooks(section: SectionId, occupied: Set<number>) {
  return useMemo(() => {
    const r = rng(hash32(`section-${section}`));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const c = new THREE.Color();
    const mats: THREE.Matrix4[] = [];
    const cols: THREE.Color[] = [];
    const tilt = new THREE.Euler();
    for (const row of [0, 1] as const) {
      const { centerZ, facing, zc } = rowGeometry(section, row);
      for (let bay = 0; bay < L.BAYS; bay++)
        for (let shelf = 0; shelf < L.SHELVES; shelf++) {
          const gapStart = r() < 0.5 ? Math.floor(r() * L.SLOTS) : -10;
          const gapLen = 1 + Math.floor(r() * 3);
          for (let slot = 0; slot < L.SLOTS; slot++) {
            const idx = slotIndex({ section, row, bay, shelf, slot });
            if (occupied.has(idx)) continue;
            if (slot >= gapStart && slot < gapStart + gapLen) continue;
            const thick = L.SLOT_PITCH * (0.62 + r() * 0.33);
            const h = 0.21 + r() * 0.12;
            const d = 0.15 + r() * 0.08;
            const lean = slot === gapStart + gapLen && r() < 0.6 ? -0.18 : 0;
            p.set(uToX(section, slotU(bay, slot)), shelfY(shelf) + h / 2, centerZ - zc + facing * (L.SHELF_DEPTH / 2 - d / 2 - 0.012));
            tilt.set(0, 0, lean * sectionSide(section));
            q.setFromEuler(tilt);
            s.set(thick, h, d);
            m.compose(p, q, s);
            mats.push(m.clone());
            const pal = bookPalette(`${section}-${idx}`);
            c.setHSL(pal.h / 360, pal.s / 100, pal.l / 100);
            cols.push(c.clone());
          }
        }
    }
    return { mats, cols };
  }, [section, occupied]);
}

function BookInstances({ section, occupied }: { section: SectionId; occupied: Set<number> }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { mats: matrices, cols } = useInstancedBooks(section, occupied);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ map: spineDetailTexture(), roughness: 0.72, metalness: 0.0 }), []);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => {
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, cols[i]);
    });
    mesh.count = matrices.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices, cols]);
  return <instancedMesh ref={ref} args={[unitBox, material, 2 * L.BAYS * L.SHELVES * L.SLOTS]} castShadow={false} receiveShadow frustumCulled />;
}

/** Far LOD: one textured "wall of spines" per row instead of 1,600 instances. */
function SpineWalls({ section }: { section: SectionId }) {
  const tex = useMemo(() => {
    const t = spineWallTexture(section).clone();
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(L.BAYS * 1.5, 1);
    t.needsUpdate = true;
    return t;
  }, [section]);
  const side = sectionSide(section);
  return (
    <>
      {([0, 1] as const).map((row) => {
        const { centerZ, zc, facing } = rowGeometry(section, row);
        return (
          <mesh key={row} position={[side * (L.MAIN_HALF + L.BAY_MARGIN + (L.BAYS * L.BAY_WIDTH) / 2), shelfY(0) + (L.SHELF_SPACING * L.SHELVES) / 2 - 0.02, centerZ - zc + facing * 0.05]} rotation-y={facing > 0 ? 0 : Math.PI}>
            <planeGeometry args={[L.BAYS * L.BAY_WIDTH, L.SHELF_SPACING * L.SHELVES]} />
            <meshStandardMaterial map={tex} roughness={0.8} />
          </mesh>
        );
      })}
    </>
  );
}

function SectionSign({ section }: { section: SectionId }) {
  const sec = sectionFor(section);
  const side = sectionSide(section);
  const tex = useMemo(
    () =>
      signTexture(
        [
          { text: `§ ${section}`, size: 120, weight: 700, color: "#f3dfae" },
          { text: sec.name.en, size: 58 },
          { text: sec.name.hi, size: 50, weight: 500, color: "#d8bf86" },
        ],
        1024,
        512,
        sec.color,
      ),
    [section, sec],
  );
  const x = side * (L.MAIN_HALF + 0.55);
  return (
    <group position={[x, 0, L.ROW_OFFSET + 0.2]}>
      <mesh position={[0, 3.35, 0]}>
        <planeGeometry args={[1.5, 0.75]} />
        <meshStandardMaterial map={tex} emissive="#ffffff" emissiveMap={tex} emissiveIntensity={0.45} side={THREE.DoubleSide} roughness={0.5} />
      </mesh>
      <mesh position={[0, 3.95, 0]} material={mats().brass}>
        <boxGeometry args={[1.6, 0.04, 0.04]} />
      </mesh>
      {[-0.7, 0.7].map((dx) => (
        <mesh key={dx} position={[dx, 4.0 + 2.5, 0]} material={mats().brass}>
          <cylinderGeometry args={[0.006, 0.006, 5, 4]} />
        </mesh>
      ))}
    </group>
  );
}

function Pendant({ x }: { x: number }) {
  const m = mats();
  return (
    <group position={[x, 3.3, 0]}>
      <mesh position={[0, 2.8, 0]} material={m.brass}>
        <cylinderGeometry args={[0.008, 0.008, 5.6, 4]} />
      </mesh>
      <mesh material={m.brass}>
        <coneGeometry args={[0.32, 0.25, 20, 1, true]} />
      </mesh>
      <mesh position={[0, -0.05, 0]} material={m.bulb}>
        <sphereGeometry args={[0.07, 10, 8]} />
      </mesh>
      <sprite position={[0, -0.12, 0]} scale={[1.4, 1.4, 1]}>
        <spriteMaterial map={glowTexture()} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.55} />
      </sprite>
    </group>
  );
}

export const SectionChunk = memo(function SectionChunk({ section, near }: { section: SectionId; near: boolean }) {
  const side = sectionSide(section);
  const geo = shelvingGeometry(side);
  const [featured, setFeatured] = useState<Featured[]>([]);
  const target = useLibrary((s) => s.target);

  useEffect(() => {
    let alive = true;
    fetch(`/api/section?id=${section}`)
      .then((r) => r.json())
      .then((d: { items: Featured[] }) => alive && setFeatured(d.items))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [section, target?.book.id]);

  const all = useMemo(() => {
    const list = [...featured];
    if (target && target.location.section === section && !list.some((f) => f.id === target.book.id))
      list.push({ id: target.book.id, title: target.book.title, author: target.book.authors[0], location: target.location });
    return list;
  }, [featured, target, section]);

  const occupied = useMemo(() => new Set(all.map((f) => slotIndex(f.location))), [all]);
  const zc = sectionZ(section);

  return (
    <group position={[0, 0, zc]}>
      <mesh geometry={geo} material={mats().shelfWood} castShadow={near} receiveShadow />
      {near ? (
        <>
          <BookInstances section={section} occupied={occupied} />
          {all.map((f) => (
            <FeaturedBook key={f.id} item={f} zOffset={-zc} />
          ))}
        </>
      ) : (
        <SpineWalls section={section} />
      )}
      <SectionSign section={section} />
      <Pendant x={side * (L.MAIN_HALF + L.BAY_MARGIN + ROW_LEN / 2)} />
      {/* runner rug along the cross-aisle */}
      <mesh rotation-x={-Math.PI / 2} position={[side * (L.MAIN_HALF + ROW_LEN / 2 + 0.3), 0.004, 0]} material={mats().rug} receiveShadow>
        <planeGeometry args={[ROW_LEN, 1.1]} />
      </mesh>
    </group>
  );
});

/**
 * Streams sections in/out around the camera. Near sections get full detail
 * (instanced books + featured books); farther ones a cheap spine-wall LOD.
 */
export function SectionStreamer() {
  const { camera } = useThree();
  const quality = useLibrary((s) => s.quality);
  const [win, setWin] = useState({ from: 0, to: 3, nearFrom: 0, nearTo: 1 });
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    const k = Math.max(0, sectionPairAt(Math.min(camera.position.z, L.FOYER_END_Z + 2)));
    const radius = quality === "low" ? 3 : quality === "medium" ? 5 : 7;
    const nearR = quality === "low" ? 1 : 2;
    const next = { from: Math.max(0, k - radius), to: k + radius, nearFrom: Math.max(0, k - nearR), nearTo: k + nearR };
    rt.sectionUnderCamera = camera.position.z < L.FOYER_END_Z ? 2 * k + 1 : 0;
    if (next.from !== win.from || next.to !== win.to || next.nearFrom !== win.nearFrom || next.nearTo !== win.nearTo) setWin(next);
  });
  const chunks: { id: number; near: boolean }[] = [];
  for (let k = win.from; k <= win.to; k++)
    for (const id of [2 * k + 1, 2 * k + 2]) chunks.push({ id, near: k >= win.nearFrom && k <= win.nearTo });
  return (
    <group>
      {chunks.map((c) => (
        <SectionChunk key={c.id} section={c.id} near={c.near} />
      ))}
    </group>
  );
}
