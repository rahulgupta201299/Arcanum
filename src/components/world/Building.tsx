"use client";

import { Instance, Instances, Stars } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { LAYOUT } from "@/lib/world/layout";
import { glowTexture, signTexture } from "@/lib/world/textures";
import { mats } from "./materials";

export const HALL_HALF = 14.5;
export const HALL_HEIGHT = 9;
const SHELL_LEN = 900; // static shell; sections stream inside it

/** Arched gate opening in the facade (shared with Gate.tsx). */
export const GATE = { halfW: 1.65, h: 4.2, archR: 1.65 };

function Facade() {
  const m = mats();
  const wallGeo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-HALL_HALF - 3, 0);
    s.lineTo(HALL_HALF + 3, 0);
    s.lineTo(HALL_HALF + 3, 12);
    s.lineTo(-HALL_HALF - 3, 12);
    s.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-GATE.halfW, 0);
    hole.lineTo(GATE.halfW, 0);
    hole.lineTo(GATE.halfW, GATE.h);
    hole.absarc(0, GATE.h, GATE.archR, 0, Math.PI, false);
    hole.lineTo(-GATE.halfW, 0);
    s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.8, bevelEnabled: false, curveSegments: 24 });
    g.translate(0, 0, -0.4);
    return g;
  }, []);
  const pediment = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-9, 0);
    s.lineTo(9, 0);
    s.lineTo(0, 2.6);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 1.2, bevelEnabled: false });
  }, []);
  const sign = useMemo(
    () =>
      signTexture(
        [
          { text: "ARCANUM", size: 130, weight: 700 },
          { text: "the infinite AI library · अनंत पुस्तकालय", size: 46, italic: true, weight: 400 },
        ],
        1600,
        320,
        "#20160e",
      ),
    [],
  );
  const glow = glowTexture();
  return (
    <group>
      <mesh geometry={wallGeo} material={m.stone} castShadow receiveShadow />
      {/* columns */}
      {[-7.5, -4.4, 4.4, 7.5].map((x) => (
        <group key={x} position={[x, 0, 1.0]}>
          <mesh position={[0, 0.25, 0]} material={m.stone} castShadow>
            <boxGeometry args={[1.3, 0.5, 1.3]} />
          </mesh>
          <mesh position={[0, 4.6, 0]} material={m.stone} castShadow receiveShadow>
            <cylinderGeometry args={[0.42, 0.5, 8.2, 24]} />
          </mesh>
          <mesh position={[0, 8.9, 0]} material={m.stone} castShadow>
            <boxGeometry args={[1.3, 0.45, 1.3]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 9.15, 1.0]} material={m.stone} castShadow receiveShadow>
        <boxGeometry args={[18.4, 0.6, 1.6]} />
      </mesh>
      <mesh geometry={pediment} position={[0, 9.45, 0.35]} material={m.stone} castShadow />
      <mesh position={[0, 7.2, 0.45]}>
        <planeGeometry args={[7.2, 1.44]} />
        <meshStandardMaterial map={sign} emissive="#ffffff" emissiveMap={sign} emissiveIntensity={0.35} roughness={0.6} />
      </mesh>
      {/* steps */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, -0.12 - i * 0.16, 1.6 + i * 0.5]} material={m.stone} receiveShadow>
          <boxGeometry args={[10 + i * 1.2, 0.3, 1.4]} />
        </mesh>
      ))}
      {/* lanterns */}
      {[-2.6, 2.6].map((x) => (
        <group key={x} position={[x, 0, 1.1]}>
          <mesh position={[0, 1.4, 0]} material={m.darkStone}>
            <cylinderGeometry args={[0.06, 0.09, 2.8, 10]} />
          </mesh>
          <mesh position={[0, 2.95, 0]} material={m.glassGlow}>
            <boxGeometry args={[0.32, 0.45, 0.32]} />
          </mesh>
          <mesh position={[0, 3.25, 0]} material={m.darkStone}>
            <coneGeometry args={[0.3, 0.25, 4]} />
          </mesh>
          <sprite position={[0, 2.95, 0.05]} scale={[1.6, 1.6, 1]}>
            <spriteMaterial map={glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.8} />
          </sprite>
        </group>
      ))}
      <pointLight position={[0, 3.2, 2.2]} intensity={14} distance={12} color="#ffb766" decay={1.8} />
      {/* plaza */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.6, 20]} material={m.darkStone} receiveShadow>
        <planeGeometry args={[80, 40]} />
      </mesh>
    </group>
  );
}

function Foyer() {
  const m = mats();
  const glow = glowTexture();
  const bulbs = useMemo(() => Array.from({ length: 16 }, (_, i) => (i / 16) * Math.PI * 2), []);
  const plaque = useMemo(
    () =>
      signTexture(
        [
          { text: "Information · सूचना", size: 64 },
          { text: "Ask the librarian", size: 38, italic: true, weight: 400 },
        ],
        1024,
        256,
      ),
    [],
  );
  return (
    <group>
      {/* rotunda dome */}
      <mesh position={[0, HALL_HEIGHT - 0.5, -8]}>
        <sphereGeometry args={[8.5, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial side={THREE.BackSide} color="#e6d6b8" roughness={0.9} map={m.plaster.map} />
      </mesh>
      <mesh position={[0, HALL_HEIGHT - 0.5, -8]} rotation-x={Math.PI / 2} material={m.trimWood}>
        <torusGeometry args={[8.5, 0.25, 12, 64]} />
      </mesh>
      {/* oculus */}
      <mesh position={[0, HALL_HEIGHT + 7.95, -8]} rotation-x={Math.PI / 2} material={m.moonGlass}>
        <circleGeometry args={[1.3, 32]} />
      </mesh>
      {/* chandelier */}
      <group position={[0, 6.2, -8]}>
        <mesh position={[0, 1.7, 0]} material={m.brass}>
          <cylinderGeometry args={[0.02, 0.02, 3.4, 6]} />
        </mesh>
        <mesh rotation-x={Math.PI / 2} material={m.brass}>
          <torusGeometry args={[1.25, 0.04, 8, 48]} />
        </mesh>
        <mesh position={[0, 0.5, 0]} rotation-x={Math.PI / 2} material={m.brass}>
          <torusGeometry args={[0.7, 0.03, 8, 32]} />
        </mesh>
        <Instances limit={bulbs.length} material={m.bulb}>
          <sphereGeometry args={[0.07, 10, 8]} />
          {bulbs.map((a, i) => (
            <Instance key={i} position={[Math.cos(a) * 1.25, 0.12, Math.sin(a) * 1.25]} />
          ))}
        </Instances>
        <sprite scale={[5, 5, 1]}>
          <spriteMaterial map={glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.5} />
        </sprite>
        <pointLight intensity={38} distance={22} color="#ffc27a" decay={1.6} castShadow={false} />
      </group>
      {/* rug */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, -8]} material={m.rugBorder} receiveShadow>
        <planeGeometry args={[5.2, 9.2]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.008, -8]} material={m.rug} receiveShadow>
        <planeGeometry args={[4.8, 8.8]} />
      </mesh>
      {/* reception desk */}
      <group position={[2.6, 0, -6.6]}>
        <mesh position={[0, 0.5, 0]} material={m.deskWood} castShadow receiveShadow>
          <boxGeometry args={[3.2, 1.0, 0.8]} />
        </mesh>
        <mesh position={[0, 1.03, 0]} material={m.trimWood} castShadow>
          <boxGeometry args={[3.35, 0.06, 0.95]} />
        </mesh>
        <mesh position={[0, 0.55, 0.405]}>
          <planeGeometry args={[1.6, 0.4]} />
          <meshStandardMaterial map={plaque} emissive="#ffffff" emissiveMap={plaque} emissiveIntensity={0.25} />
        </mesh>
        {/* banker's lamp */}
        <group position={[1.1, 1.06, -0.1]}>
          <mesh position={[0, 0.02, 0]} material={m.brass}>
            <cylinderGeometry args={[0.1, 0.12, 0.04, 16]} />
          </mesh>
          <mesh position={[0, 0.18, 0]} material={m.brass}>
            <cylinderGeometry args={[0.012, 0.012, 0.32, 8]} />
          </mesh>
          <mesh position={[0, 0.34, 0.02]} rotation-x={0.2}>
            <cylinderGeometry args={[0.07, 0.16, 0.1, 16, 1, true]} />
            <meshStandardMaterial color="#1f5b3a" emissive="#0d3a22" roughness={0.3} metalness={0.3} side={THREE.DoubleSide} />
          </mesh>
        </group>
        {/* book stack */}
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[-1.0 + i * 0.01, 1.1 + i * 0.05, 0.05]} rotation-y={i * 0.25} castShadow>
            <boxGeometry args={[0.32, 0.05, 0.24]} />
            <meshStandardMaterial color={["#6b1e1e", "#1e3a6b", "#2e5a2a", "#6b5a1e"][i]} roughness={0.7} />
          </mesh>
        ))}
      </group>
      {/* globe */}
      <group position={[-3.4, 0, -6.4]}>
        <mesh position={[0, 0.45, 0]} material={m.trimWood} castShadow>
          <cylinderGeometry args={[0.06, 0.22, 0.9, 12]} />
        </mesh>
        <mesh position={[0, 1.2, 0]} rotation-z={0.4} castShadow>
          <sphereGeometry args={[0.38, 32, 24]} />
          <meshStandardMaterial color="#c8b07a" roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.2, 0]} rotation-z={0.4} material={m.brass}>
          <torusGeometry args={[0.42, 0.015, 8, 48]} />
        </mesh>
      </group>
      {/* reading chairs */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 6.8, 0, -11]} rotation-y={-s * 0.6}>
          <mesh position={[0, 0.25, 0]} material={m.leather} castShadow>
            <boxGeometry args={[0.9, 0.5, 0.85]} />
          </mesh>
          <mesh position={[0, 0.75, -0.36]} material={m.leather} castShadow>
            <boxGeometry args={[0.9, 0.7, 0.18]} />
          </mesh>
          {[-1, 1].map((a) => (
            <mesh key={a} position={[a * 0.42, 0.55, 0]} material={m.leather}>
              <boxGeometry args={[0.14, 0.3, 0.85]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* potted plants */}
      {[
        [-8, -2],
        [8, -2],
        [-8, -14],
        [8, -14],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.35, 0]} material={m.darkStone} castShadow>
            <cylinderGeometry args={[0.35, 0.28, 0.7, 16]} />
          </mesh>
          <mesh position={[0, 1.15, 0]} material={m.plant} castShadow>
            <icosahedronGeometry args={[0.65, 1]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** The long hall shell (floor, walls, ceiling, windows) that follows the camera. */
function HallShell() {
  const m = mats();
  const foyerCeiling = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-HALL_HALF, 0.4);
    s.lineTo(HALL_HALF, 0.4);
    s.lineTo(HALL_HALF, -16.6);
    s.lineTo(-HALL_HALF, -16.6);
    s.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, -8, 8.5, 0, Math.PI * 2, true);
    s.holes.push(hole);
    const g = new THREE.ShapeGeometry(s, 48);
    // shape authored in (x, z): rotateX(+90°) maps (x, y) → (x, 0, y), normal facing down
    g.rotateX(Math.PI / 2);
    return g;
  }, []);
  const floorMat = useMemo(() => {
    const mat = m.floor.clone();
    mat.map = m.floor.map!.clone();
    mat.map.repeat.set((HALL_HALF * 2) / 5.2, SHELL_LEN / 5.2);
    mat.map.needsUpdate = true;
    return mat;
  }, [m]);
  const pilasters = useMemo(() => {
    const out: [number, number][] = [];
    for (let z = 0; z > -SHELL_LEN; z -= LAYOUT.SECTION_DEPTH) for (const s of [-1, 1]) out.push([s * (HALL_HALF - 0.15), z - 0.3]);
    return out;
  }, []);
  const windows = useMemo(() => {
    const out: [number, number][] = [];
    for (let z = -LAYOUT.SECTION_DEPTH / 2; z > -SHELL_LEN; z -= LAYOUT.SECTION_DEPTH * 2) for (const s of [-1, 1]) out.push([s * (HALL_HALF - 0.02), z]);
    return out;
  }, []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -SHELL_LEN / 2 + 0.4]} material={floorMat} receiveShadow>
        <planeGeometry args={[HALL_HALF * 2, SHELL_LEN]} />
      </mesh>
      {/* walls */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * HALL_HALF, HALL_HEIGHT / 2, -SHELL_LEN / 2]} rotation-y={-s * (Math.PI / 2)} material={m.plaster} receiveShadow>
          <planeGeometry args={[SHELL_LEN, HALL_HEIGHT]} />
        </mesh>
      ))}
      {/* wainscot */}
      {[-1, 1].map((s) => (
        <mesh key={`w${s}`} position={[s * (HALL_HALF - 0.05), 0.6, -SHELL_LEN / 2]} rotation-y={-s * (Math.PI / 2)} material={m.shelfWood}>
          <planeGeometry args={[SHELL_LEN, 1.2]} />
        </mesh>
      ))}
      {/* ceiling */}
      <mesh rotation-x={Math.PI / 2} position={[0, HALL_HEIGHT, -16.6 - SHELL_LEN / 2]} material={m.ceiling}>
        <planeGeometry args={[HALL_HALF * 2, SHELL_LEN]} />
      </mesh>
      <mesh geometry={foyerCeiling} position={[0, HALL_HEIGHT, 0]} material={m.ceiling} />
      <Instances limit={pilasters.length} material={m.trimWood} castShadow={false}>
        <boxGeometry args={[0.5, HALL_HEIGHT, 0.6]} />
        {pilasters.map(([x, z], i) => (
          <Instance key={i} position={[x, HALL_HEIGHT / 2, z]} />
        ))}
      </Instances>
      <Instances limit={pilasters.length / 2} material={m.trimWood}>
        <boxGeometry args={[HALL_HALF * 2, 0.45, 0.35]} />
        {pilasters
          .filter((_, i) => i % 2 === 0)
          .map(([, z], i) => (
            <Instance key={i} position={[0, HALL_HEIGHT - 0.22, z]} />
          ))}
      </Instances>
      <Instances limit={windows.length} material={m.moonGlass}>
        <planeGeometry args={[2.2, 3.6]} />
        {windows.map(([x, z], i) => (
          <Instance key={i} position={[x, 5.6, z]} rotation={[0, x > 0 ? -Math.PI / 2 : Math.PI / 2, 0]} />
        ))}
      </Instances>
    </group>
  );
}

export function Building() {
  return (
    <group>
      <Stars radius={90} depth={40} count={2500} factor={3} saturation={0} fade speed={0.4} />
      <Facade />
      <Foyer />
      <HallShell />
    </group>
  );
}
