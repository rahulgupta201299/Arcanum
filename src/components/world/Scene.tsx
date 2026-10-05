"use client";

import { AdaptiveDpr, Environment, Lightformer, PerformanceMonitor, Preload } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Suspense, useRef } from "react";
import * as THREE from "three";
import { LAYOUT, sectionPairAt, sectionSide, sectionZ } from "@/lib/world/layout";
import { rt } from "@/lib/world/runtime";
import { useLibrary } from "@/store/useLibrary";
import { Librarian } from "../librarian/Librarian";
import { Building } from "./Building";
import { CameraRig } from "./CameraRig";
import { Director } from "./Director";
import { Gate } from "./Gate";
import { HeldBook } from "./HeldBook";
import { PathTrail } from "./PathTrail";
import { SectionStreamer } from "./Sections";

/** A small pool of real point lights that follows the camera to the nearest pendant lamps. */
function LightPool() {
  const refs = useRef<(THREE.PointLight | null)[]>([]);
  const { camera } = useThree();
  useFrame(() => {
    const z = camera.position.z;
    const k = Math.max(0, sectionPairAt(Math.min(z, LAYOUT.FOYER_END_Z)));
    const lamps: THREE.Vector3[] = [];
    for (let p = Math.max(0, k - 1); p <= k + 1; p++)
      for (const s of [2 * p + 1, 2 * p + 2]) lamps.push(new THREE.Vector3(sectionSide(s) * (LAYOUT.MAIN_HALF + LAYOUT.BAY_MARGIN + 5.2), 3.15, sectionZ(s)));
    lamps.sort((a, b) => a.distanceToSquared(camera.position) - b.distanceToSquared(camera.position));
    refs.current.forEach((l, i) => {
      if (!l) return;
      const p = lamps[i];
      if (p) l.position.copy(p);
      l.intensity = z < LAYOUT.FOYER_END_Z + 8 ? 12 : 0;
    });
  });
  return (
    <>
      {[0, 1].map((i) => (
        <pointLight key={i} ref={(l) => void (refs.current[i] = l)} color="#ffc98a" distance={11} decay={1.6} intensity={0} />
      ))}
    </>
  );
}

/** Key light (moonlight through the windows + warm fill) whose shadow frustum follows the action. */
function KeyLight() {
  const ref = useRef<THREE.DirectionalLight>(null);
  const quality = useLibrary((s) => s.quality);
  useFrame(() => {
    const l = ref.current;
    if (!l) return;
    const f = rt.lib.pos;
    l.position.set(f.x + 6, 12, f.z + 7);
    l.target.position.set(f.x, 0, f.z);
    l.target.updateMatrixWorld();
  });
  return (
    <directionalLight
      ref={ref}
      intensity={0.9}
      color="#ffe2bd"
      castShadow={quality !== "low"}
      shadow-mapSize={quality === "high" ? [2048, 2048] : [1024, 1024]}
      shadow-camera-left={-8}
      shadow-camera-right={8}
      shadow-camera-top={8}
      shadow-camera-bottom={-8}
      shadow-camera-near={1}
      shadow-camera-far={40}
      shadow-bias={-0.0004}
      shadow-normalBias={0.02}
    />
  );
}

function Effects() {
  const quality = useLibrary((s) => s.quality);
  if (quality === "low") return null;
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom mipmapBlur intensity={quality === "high" ? 0.75 : 0.5} luminanceThreshold={0.85} luminanceSmoothing={0.2} />
      <Vignette offset={0.25} darkness={0.6} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA />
    </EffectComposer>
  );
}

export function Scene() {
  const set = useLibrary((s) => s.set);
  const quality = useLibrary((s) => s.quality);
  return (
    <Canvas
      shadows
      dpr={quality === "high" ? [1, 1.75] : quality === "medium" ? [1, 1.4] : [0.75, 1]}
      gl={{ antialias: false, powerPreference: "high-performance", toneMapping: quality === "low" ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping }}
      camera={{ position: [0, 1.75, 9.2], fov: 50, near: 0.05, far: 160 }}
      onCreated={({ gl, scene, camera }) => {
        if (process.env.NODE_ENV !== "production" || location.search.includes("debug")) Object.assign(window, { __lv: { gl, scene, camera, rt, store: useLibrary } });
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        scene.background = new THREE.Color("#07080d");
        scene.fog = new THREE.Fog("#1a120c", 24, 70);
      }}
    >
      <PerformanceMonitor
        onDecline={() => set("quality", quality === "high" ? "medium" : "low")}
        onIncline={() => quality === "low" && set("quality", "medium")}
        flipflops={3}
      />
      <AdaptiveDpr pixelated={false} />
      <hemisphereLight args={["#ffe9cc", "#2a1a10", 0.6]} />
      <ambientLight intensity={0.18} color="#ffd9a8" />
      <KeyLight />
      <LightPool />
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={1.4} color="#ffcf91" position={[0, 6, -8]} scale={[12, 3, 1]} rotation-x={Math.PI / 2} />
        <Lightformer form="rect" intensity={0.6} color="#8aa6d6" position={[-10, 4, -20]} scale={[2, 6, 1]} rotation-y={Math.PI / 2} />
        <Lightformer form="rect" intensity={0.6} color="#8aa6d6" position={[10, 4, -20]} scale={[2, 6, 1]} rotation-y={-Math.PI / 2} />
        <Lightformer form="ring" intensity={1.2} color="#ffb766" position={[0, 2, 6]} scale={3} />
      </Environment>
      <Suspense fallback={null}>
        <Building />
        <Gate />
        <SectionStreamer />
        <Librarian />
        <HeldBook />
        <PathTrail />
        <Preload all />
      </Suspense>
      <Director />
      <CameraRig />
      <Effects />
    </Canvas>
  );
}
