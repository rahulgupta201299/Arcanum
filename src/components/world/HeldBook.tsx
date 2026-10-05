"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { rt } from "@/lib/world/runtime";
import { glowTexture } from "@/lib/world/textures";
import { useLibrary } from "@/store/useLibrary";
import { BookMesh, useBookMaterials } from "./FeaturedBook";

/** The physical copy of the target book that leaves the shelf and travels to the user. */
export function HeldBook() {
  const target = useLibrary((s) => s.target);
  if (!target) return null;
  return <HeldBookInner key={target.book.id} book={target.book} />;
}

function HeldBookInner({ book }: { book: { id: string; title: string; authors: string[]; pages?: number } }) {
  const ref = useRef<THREE.Group>(null);
  const sparkle = useRef<THREE.Sprite>(null);
  const materials = useBookMaterials(book);
  const glowMat = useMemo(
    () => new THREE.SpriteMaterial({ map: glowTexture(), color: "#ffd27a", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }),
    [],
  );
  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    g.visible = rt.book.visible && rt.book.stage > 0;
    g.position.copy(rt.book.pos);
    g.quaternion.copy(rt.book.quat);
    if (sparkle.current) {
      sparkle.current.position.copy(rt.book.pos).add(new THREE.Vector3(0, 0.12, 0));
      const pulse = 0.5 + Math.sin(state.clock.elapsedTime * 5) * 0.2;
      glowMat.opacity = rt.book.highlight * pulse;
      sparkle.current.visible = rt.book.highlight > 0.02;
    }
  });
  return (
    <>
      <group ref={ref} visible={false}>
        <BookMesh book={book} materials={materials} />
      </group>
      <sprite ref={sparkle} scale={[0.7, 0.7, 1]} material={glowMat} visible={false} />
    </>
  );
}
