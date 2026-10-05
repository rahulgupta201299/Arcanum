"use client";

import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Component, Suspense, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { rt } from "@/lib/world/runtime";
import { useLibrary } from "@/store/useLibrary";
import { Hologram } from "./Hologram";
import { ProceduralLibrarian } from "./ProceduralLibrarian";

/**
 * Avatar selector. Drop a rigged GLB at /public/models/librarian-female.glb or
 * librarian-male.glb (Ready Player Me / Mixamo / custom) with clips named
 * idle / walk / talk / think / reach / present / wave and it replaces the
 * procedural avatar automatically — behaviour comes from the same rt.lib channels.
 */
export function Librarian() {
  const { gender, name } = useLibrary((s) => s.librarian);
  const hasModel = useLibrary((s) => s.models[gender]);
  const glb = hasModel ? `/models/librarian-${gender}.glb` : null;

  const procedural = <ProceduralLibrarian key={`${gender}-${name}`} gender={gender} name={name} />;
  return (
    <group>
      {glb ? (
        <GLTFBoundary fallback={procedural}>
          <Suspense fallback={procedural}>
            <GLTFLibrarian url={glb} />
          </Suspense>
        </GLTFBoundary>
      ) : (
        procedural
      )}
      <Hologram />
      <FaceLight />
    </group>
  );
}

class GLTFBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const CLIP_FOR: Record<string, string[]> = {
  idle: ["idle", "stand"],
  walk: ["walk"],
  think: ["think", "idle"],
  wave: ["wave", "greet"],
  turn: ["walk", "idle"],
  scan: ["look", "idle"],
  reach: ["reach", "pick", "grab"],
  pull: ["reach", "pick", "grab"],
  present: ["present", "hold", "give", "idle"],
  point: ["point", "idle"],
  talk: ["talk", "idle"],
};

function GLTFLibrarian({ url }: { url: string }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(url);
  const { actions, names } = useAnimations(animations, group);
  const current = useRef<string | null>(null);
  const bones = useMemo(() => {
    let handR: THREE.Object3D | null = null;
    let handL: THREE.Object3D | null = null;
    let head: THREE.Object3D | null = null;
    scene.traverse((o) => {
      const n = o.name.toLowerCase();
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
      if (!handR && /right.?hand$|hand_r$|r_hand$/.test(n)) handR = o;
      if (!handL && /left.?hand$|hand_l$|l_hand$/.test(n)) handL = o;
      if (!head && /head$/.test(n)) head = o;
    });
    return { handR, handL, head } as { handR: THREE.Object3D | null; handL: THREE.Object3D | null; head: THREE.Object3D | null };
  }, [scene]);

  useFrame(() => {
    const L = rt.lib;
    if (!group.current) return;
    group.current.position.copy(L.pos);
    group.current.rotation.y = L.yaw;
    const key = L.speaking && L.action === "idle" ? "talk" : L.action;
    const wanted = (CLIP_FOR[key] ?? ["idle"]).map((c) => names.find((n) => n.toLowerCase().includes(c))).find(Boolean) ?? names[0];
    if (wanted && wanted !== current.current) {
      actions[current.current ?? ""]?.fadeOut(0.3);
      actions[wanted]?.reset().fadeIn(0.3).play();
      current.current = wanted;
    }
    bones.handR?.getWorldPosition(L.handR);
    bones.handL?.getWorldPosition(L.handL);
    if (bones.head) {
      bones.head.getWorldPosition(L.chest);
      L.chest.y -= 0.35;
    }
  });

  return <primitive ref={group} object={scene} />;
}

/** Soft portrait key-light that follows the librarian's face (flattering, warm). */
function FaceLight() {
  const ref = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const l = ref.current;
    if (!l) return;
    const L = rt.lib;
    l.position.set(L.pos.x + L.forward.x * 0.9 + L.forward.z * 0.35, (L.chest.y || 1.2) + 0.55, L.pos.z + L.forward.z * 0.9 - L.forward.x * 0.35);
  });
  return <pointLight ref={ref} intensity={1.6} distance={2.6} decay={1.5} color="#ffe2c8" />;
}
