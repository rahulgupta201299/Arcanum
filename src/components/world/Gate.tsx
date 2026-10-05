"use client";

import { useFrame } from "@react-three/fiber";
import { easing } from "maath";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useLibrary } from "@/store/useLibrary";
import { woodTexture } from "@/lib/world/textures";
import { GATE } from "./Building";
import { mats } from "./materials";

/** Monumental double doors that swing inward when the user enters. */
export function Gate() {
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const m = mats();

  const { leafGeo, doorMat } = useMemo(() => {
    const s = new THREE.Shape();
    const { halfW, h, archR } = GATE;
    s.moveTo(0, 0);
    s.lineTo(halfW, 0);
    s.lineTo(halfW, h + archR);
    s.absarc(halfW, h, archR, Math.PI / 2, Math.PI, false);
    s.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, curveSegments: 20 });
    g.translate(0, 0, -0.06);
    const tex = woodTexture("#3a1f0e", "door").clone();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(0.6, 0.25);
    tex.rotation = Math.PI / 2;
    tex.needsUpdate = true;
    return { leafGeo: g, doorMat: new THREE.MeshStandardMaterial({ map: tex, color: "#9a6a43", roughness: 0.55 }) };
  }, []);

  const panels = useMemo(() => {
    const out: [number, number, number, number][] = [];
    for (let r = 0; r < 3; r++) out.push([GATE.halfW / 2, 0.55 + r * 1.25, GATE.halfW * 0.7, 1.0]);
    return out;
  }, []);

  useFrame((_, dt) => {
    const phase = useLibrary.getState().phase;
    const open = phase !== "gate";
    const target = open ? 2.85 : 0; // swing flat against the inner wall
    // ease-in-out feel: heavy door
    if (left.current) easing.damp(left.current.rotation, "y", target, 0.9, dt);
    if (right.current) easing.damp(right.current.rotation, "y", -target, 0.95, dt);
  });

  const Leaf = ({ mirror }: { mirror?: boolean }) => (
    <group scale={[mirror ? -1 : 1, 1, 1]}>
      <mesh geometry={leafGeo} material={doorMat} castShadow receiveShadow />
      {panels.map(([x, y, w, h], i) => (
        <group key={i}>
          {[0.07, -0.07].map((z) => (
            <mesh key={z} position={[x, y + h / 2, z]} material={doorMat}>
              <boxGeometry args={[w, h, 0.03]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* brass studs */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[0.12, 0.4 + i * 0.75, 0.08]} material={m.brass}>
          <sphereGeometry args={[0.03, 8, 6]} />
        </mesh>
      ))}
      {/* ring handle */}
      <mesh position={[GATE.halfW - 0.28, 1.9, 0.11]} material={m.brass}>
        <torusGeometry args={[0.11, 0.018, 8, 24]} />
      </mesh>
      <mesh position={[GATE.halfW - 0.28, 2.0, 0.09]} material={m.brass}>
        <cylinderGeometry args={[0.04, 0.04, 0.03, 12]} />
      </mesh>
    </group>
  );

  return (
    <group position={[0, 0, 0]}>
      <group ref={left} position={[-GATE.halfW, 0, 0]}>
        <Leaf />
      </group>
      <group ref={right} position={[GATE.halfW, 0, 0]}>
        <Leaf mirror />
      </group>
      {/* threshold */}
      <mesh position={[0, 0.01, 0]} material={m.brass} receiveShadow>
        <boxGeometry args={[GATE.halfW * 2, 0.03, 0.8]} />
      </mesh>
    </group>
  );
}
