"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { rt } from "@/lib/world/runtime";
import { glowTexture } from "@/lib/world/textures";

/**
 * The "AI-verse" layer: while the librarian thinks, translucent catalogue
 * cards orbit her, a search ring pulses at her feet and motes rise.
 */
export function Hologram() {
  const group = useRef<THREE.Group>(null);
  const cards = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const motes = useRef<THREE.Points>(null);
  const cardMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({ color: "#7fe3ff", transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
    [],
  );
  const ringMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#6fd8ff", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    [],
  );
  const moteGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = 80;
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.3 + Math.random() * 0.5;
      p.set([Math.cos(a) * r, Math.random() * 2.2, Math.sin(a) * r], i * 3);
    }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  const moteMat = useMemo(
    () => new THREE.PointsMaterial({ map: glowTexture(), size: 0.06, color: "#9feaff", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    [],
  );

  useFrame((state, dt) => {
    const w = rt.lib.thinkWeight;
    if (!group.current) return;
    group.current.visible = w > 0.01;
    if (!group.current.visible) return;
    group.current.position.copy(rt.lib.pos);
    const t = state.clock.elapsedTime;
    cardMat.opacity = 0.32 * w;
    ringMat.opacity = (0.35 + Math.sin(t * 4) * 0.15) * w;
    moteMat.opacity = 0.8 * w;
    if (cards.current) {
      cards.current.rotation.y += dt * 0.9;
      cards.current.children.forEach((c, i) => (c.position.y = 1.55 + Math.sin(t * 2 + i) * 0.06));
    }
    if (ring.current) ring.current.scale.setScalar(1 + ((t * 0.8) % 1) * 0.6);
    const pos = moteGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + dt * 0.5;
      if (y > 2.3) y = 0;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  });

  return (
    <group ref={group} visible={false}>
      <group ref={cards}>
        {Array.from({ length: 9 }, (_, i) => {
          const a = (i / 9) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.75, 1.55, Math.sin(a) * 0.75]} rotation-y={-a + Math.PI / 2} material={cardMat}>
              <planeGeometry args={[0.16, 0.22]} />
            </mesh>
          );
        })}
      </group>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} material={ringMat}>
        <ringGeometry args={[0.55, 0.6, 64]} />
      </mesh>
      <points geometry={moteGeo} material={moteMat} />
    </group>
  );
}
