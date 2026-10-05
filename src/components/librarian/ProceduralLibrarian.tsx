"use client";

import { useFrame } from "@react-three/fiber";
import { easing } from "maath";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { hash32, rng } from "@/lib/search/text";
import { rt } from "@/lib/world/runtime";
import type { Gender } from "@/store/useLibrary";
import { LibrarianHead, type HeadLook } from "./LibrarianHead";
import { hairTexture } from "@/lib/world/textures";

/**
 * A fully procedural, articulated librarian (no assets required).
 * Bones are plain Object3D groups driven every frame by:
 *   walk cycle · breathing · head look-at · blink · lip flap ·
 *   analytic two-bone arm IK (reach / present / think) · crouch.
 * The same `rt.lib` behaviour channels can drive a GLTF rig instead.
 */

const UP = new THREE.Vector3(0, -1, 0);
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpQ2 = new THREE.Quaternion();

interface Arm {
  upper: THREE.Group;
  fore: THREE.Group;
  hand: THREE.Group;
  side: 1 | -1;
}

function solveArm(arm: Arm, chest: THREE.Object3D, targetWorld: THREE.Vector3, L1: number, L2: number, weight: number, restUpper: THREE.Quaternion, restFore: THREE.Quaternion) {
  if (weight <= 0.001) {
    arm.upper.quaternion.copy(restUpper);
    arm.fore.quaternion.copy(restFore);
    return;
  }
  const T = chest.worldToLocal(tmpV.copy(targetWorld));
  const S = arm.upper.position;
  const d = tmpV2.copy(T).sub(S);
  const D = THREE.MathUtils.clamp(d.length(), 0.08, L1 + L2 - 0.002);
  const dir = d.normalize();
  const cosA = THREE.MathUtils.clamp((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1);
  const a = Math.acos(cosA);
  // right arm (side 1) lives at −x, so its elbow points towards −x
  const pole = new THREE.Vector3(-arm.side * 0.55, -0.6, -0.6).normalize();
  const polePerp = pole.sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  const upperDir = dir.clone().multiplyScalar(Math.cos(a)).add(polePerp.multiplyScalar(Math.sin(a))).normalize();
  const E = S.clone().add(upperDir.clone().multiplyScalar(L1));
  const target = S.clone().add(dir.multiplyScalar(D));
  const foreDir = target.sub(E).normalize();
  const q1 = tmpQ.setFromUnitVectors(UP, upperDir);
  const foreLocal = foreDir.applyQuaternion(tmpQ2.copy(q1).invert());
  const q2 = new THREE.Quaternion().setFromUnitVectors(UP, foreLocal);
  arm.upper.quaternion.copy(restUpper).slerp(q1, weight);
  arm.fore.quaternion.copy(restFore).slerp(q2, weight);
}

const SKIN = ["#d9a383", "#e8bc9a", "#c68863", "#b47a58", "#f1cdb0", "#9c6748"];

export function ProceduralLibrarian({ gender, name }: { gender: Gender; name: string }) {
  const female = gender === "female";
  const r = useMemo(() => rng(hash32(name + gender)), [name, gender]);
  const look = useMemo<HeadLook & { outfit: string; accent: string }>(() => {
    const pickOne = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
    return {
      female,
      skin: pickOne(SKIN),
      hair: pickOne(female ? ["#2a1a12", "#3b2416", "#5a3622", "#16110e", "#7a4a2a"] : ["#1d1410", "#2e1d14", "#3e2a1c", "#141414"]),
      eyes: pickOne(["#5a3a1e", "#3d6b4a", "#6b4a2a", "#3a5a7a", "#7a5a2a"]),
      lips: female ? pickOne(["#c2545f", "#b5485a", "#c76b6b", "#a8434f"]) : pickOne(["#a86a5a", "#9a5f52"]),
      hairStyle: female ? pickOne<HeadLook["hairStyle"]>(["long", "long", "bob", "bun"]) : pickOne<HeadLook["hairStyle"]>(["quiff", "side"]),
      glasses: r() < 0.45,
      stubble: false,
      outfit: female ? pickOne(["#1d5c55", "#6b1f3a", "#253a6b", "#7a5a1e", "#4a2a5e"]) : pickOne(["#3b2a1e", "#2b3340", "#41303f", "#2e3b2e"]),
      accent: female ? pickOne(["#f2e6d0", "#f6dfe2", "#e8eef6"]) : pickOne(["#eef1f5", "#f3ece0", "#e6eef6"]),
    };
  }, [r, female]);

  const M = useMemo(
    () => ({
      skin: new THREE.MeshPhysicalMaterial({ color: look.skin, roughness: 0.46, sheen: 0.7, sheenColor: new THREE.Color("#ffc2a8"), sheenRoughness: 0.5, clearcoat: 0.06, clearcoatRoughness: 0.6 }),
      hair: new THREE.MeshPhysicalMaterial({ map: hairTexture(look.hair), roughness: 0.5, sheen: 1, sheenColor: new THREE.Color("#b08a66"), sheenRoughness: 0.3 }),
      outfit: new THREE.MeshPhysicalMaterial({ color: look.outfit, roughness: 0.72, sheen: 0.35, sheenColor: new THREE.Color("#d8d0c4"), sheenRoughness: 0.7 }),
      shirt: new THREE.MeshPhysicalMaterial({ color: look.accent, roughness: 0.6, sheen: 0.5, sheenColor: new THREE.Color("#ffffff") }),
      trousers: new THREE.MeshStandardMaterial({ color: female ? "#2a2a2e" : "#23232a", roughness: 0.7 }),
      shoe: new THREE.MeshPhysicalMaterial({ color: "#1a120d", roughness: 0.25, clearcoat: 0.8 }),
      tie: new THREE.MeshPhysicalMaterial({ color: "#7a1f2a", roughness: 0.4, sheen: 0.6 }),
      badge: new THREE.MeshStandardMaterial({ color: "#d4ab55", metalness: 0.9, roughness: 0.22 }),
    }),
    [look, female],
  );

  // proportions
  const P = female
    ? { thigh: 0.44, shin: 0.43, hipW: 0.092, upper: 0.28, fore: 0.25, shoulderW: 0.168, torso: 0.49, headR: 0.098 }
    : { thigh: 0.47, shin: 0.46, hipW: 0.1, upper: 0.3, fore: 0.27, shoulderW: 0.205, torso: 0.55, headR: 0.104 };
  const legLen = P.thigh + P.shin + 0.06;

  const root = useRef<THREE.Group>(null);
  const hips = useRef<THREE.Group>(null);
  const spine = useRef<THREE.Group>(null);
  const chest = useRef<THREE.Group>(null);
  const neck = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const jaw = useRef<THREE.Mesh>(null);
  const skirt = useRef<THREE.Mesh>(null);
  const legs = useRef<{ thigh: THREE.Group; shin: THREE.Group; foot: THREE.Group }[]>([]);
  const arms = useRef<Arm[]>([]);
  const rest = useMemo(
    () => ({
      upperR: new THREE.Quaternion(),
      foreR: new THREE.Quaternion(),
      upperL: new THREE.Quaternion(),
      foreL: new THREE.Quaternion(),
    }),
    [],
  );
  const st = useRef({ blinkT: 2, blink: 0, headYaw: 0, headPitch: 0, t: 0, wavePhase: 0 });
  const handTargetR = useMemo(() => new THREE.Vector3(), []);
  const handTargetL = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, rt.dtMax);
    const L = rt.lib;
    const s = st.current;
    s.t += dt;
    if (!root.current || !hips.current || !chest.current || !spine.current || !head.current || !neck.current) return;

    // ---- root transform
    root.current.position.copy(L.pos);
    root.current.rotation.y = L.yaw;

    // ---- weights per action
    const a = L.action;
    easing.damp(L, "thinkWeight", a === "think" ? 1 : 0, 0.25, dt);
    easing.damp(L, "waveWeight", a === "wave" ? 1 : 0, 0.2, dt);
    easing.damp(L, "presentWeight", a === "present" ? 1 : 0, 0.3, dt);
    easing.damp(L, "pointWeight", a === "point" || a === "scan" ? 1 : 0, 0.25, dt);
    const walkAmt = THREE.MathUtils.clamp(L.speed / 1.2, 0, 1);

    // ---- walk cycle
    L.walkCycle += dt * (2.0 + L.speed * 3.2) * (walkAmt > 0.02 ? 1 : 0);
    const c = L.walkCycle;
    const prevStep = Math.sign(Math.sin(c - dt * 4));
    if (walkAmt > 0.2 && Math.sign(Math.sin(c)) !== prevStep) rt.footstep++;

    const breathe = Math.sin(s.t * 1.6) * 0.5 + 0.5;
    const crouch = L.crouch;
    hips.current.position.y = legLen - crouch * 0.38 + Math.abs(Math.sin(c)) * 0.025 * walkAmt - 0.012 * walkAmt;
    hips.current.rotation.y = Math.sin(c) * 0.08 * walkAmt;
    hips.current.rotation.z = Math.sin(c) * 0.03 * walkAmt;
    spine.current.rotation.x = 0.05 * walkAmt + crouch * 0.35 + L.reachWeight * 0.08;
    spine.current.rotation.y = -Math.sin(c) * 0.1 * walkAmt;
    chest.current.scale.set(1 + breathe * 0.012, 1 + breathe * 0.008, 1 + breathe * 0.02);
    chest.current.rotation.z = Math.sin(s.t * 0.7) * 0.012 * (1 - walkAmt);

    legs.current.forEach((leg, i) => {
      const ph = c + (i === 0 ? 0 : Math.PI);
      const swing = Math.sin(ph) * 0.48 * walkAmt;
      const knee = Math.max(0, Math.sin(ph + 1.2)) * 0.75 * walkAmt;
      leg.thigh.rotation.x = -swing - crouch * 1.25;
      leg.shin.rotation.x = knee + crouch * 2.1;
      leg.foot.rotation.x = -knee * 0.3 - crouch * 0.85 + Math.max(0, -Math.sin(ph)) * 0.2 * walkAmt;
    });
    if (skirt.current) {
      skirt.current.rotation.x = Math.sin(c) * 0.04 * walkAmt - crouch * 0.4;
      skirt.current.scale.set(1 + crouch * 0.25, 1 - crouch * 0.25, 1 + crouch * 0.4);
    }

    // ---- head look-at (in root space)
    root.current.updateMatrixWorld(true);
    const localLook = root.current.worldToLocal(tmpV.copy(L.lookAt));
    const headPos = new THREE.Vector3(0, hips.current.position.y + P.torso + 0.16, 0);
    const dl = localLook.sub(headPos);
    const wantYaw = THREE.MathUtils.clamp(Math.atan2(dl.x, dl.z), -1.1, 1.1);
    const wantPitch = THREE.MathUtils.clamp(-Math.atan2(dl.y, Math.hypot(dl.x, dl.z)), -0.6, 0.5) + L.thinkWeight * -0.25;
    easing.damp(s, "headYaw", wantYaw, 0.18, dt);
    easing.damp(s, "headPitch", wantPitch, 0.18, dt);
    neck.current.rotation.y = s.headYaw * 0.35;
    head.current.rotation.y = s.headYaw * 0.65;
    head.current.rotation.x = s.headPitch * 0.8 - crouch * 0.2;
    head.current.rotation.z = L.thinkWeight * 0.14 + Math.sin(s.t * 0.9) * 0.015;

    // ---- blink
    s.blinkT -= dt;
    if (s.blinkT < 0) {
      s.blink = 1;
      s.blinkT = 2.5 + r() * 3.5;
    }
    s.blink = Math.max(0, s.blink - dt * 7);
    if (eyes.current) eyes.current.scale.y = 1 - Math.sin(s.blink * Math.PI) * 0.92;

    // ---- mouth (procedural lip flap while speaking)
    const talk = L.speaking ? 0.25 + 0.75 * Math.abs(Math.sin(s.t * 13.0) * Math.sin(s.t * 4.7 + 1.3)) : 0;
    easing.damp(L, "mouth", talk, 0.05, dt);
    if (jaw.current) jaw.current.scale.y = 0.15 + L.mouth * 1.1;

    // ---- arms: rest pose (FK swing) then IK blend
    const armSwing = Math.sin(c) * 0.42 * walkAmt;
    const idleSway = Math.sin(s.t * 1.1) * 0.03;
    rest.upperR.setFromEuler(new THREE.Euler(armSwing + idleSway + 0.05, 0, -0.12));
    rest.foreR.setFromEuler(new THREE.Euler(-0.25 - Math.max(0, armSwing) * 0.6 + (L.speaking ? Math.sin(s.t * 2.3) * 0.25 - 0.35 : 0), 0, 0));
    rest.upperL.setFromEuler(new THREE.Euler(-armSwing + idleSway + 0.05, 0, 0.12));
    rest.foreL.setFromEuler(new THREE.Euler(-0.25 - Math.max(0, -armSwing) * 0.6 + (L.speaking ? Math.sin(s.t * 1.7 + 1) * 0.2 - 0.25 : 0), 0, 0));

    root.current.updateMatrixWorld(true);
    const ch = chest.current;
    const [armR, armL] = arms.current;
    if (!armR || !armL) return;

    // right-hand goals (world space)
    const goals: { p: THREE.Vector3; w: number }[] = [];
    const toWorld = (x: number, y: number, z: number) => root.current!.localToWorld(new THREE.Vector3(x, y, z));
    const chestY = hips.current.position.y + P.torso * 0.75;
    const headY = hips.current.position.y + P.torso + 0.18;
    if (L.thinkWeight > 0.01) goals.push({ p: toWorld(-0.03, headY - 0.13, 0.12), w: L.thinkWeight });
    if (L.waveWeight > 0.01) {
      s.wavePhase += dt * 9;
      goals.push({ p: toWorld(-0.32 + Math.sin(s.wavePhase) * 0.08, headY + 0.12, 0.12), w: L.waveWeight });
    }
    if (L.pointWeight > 0.01) {
      const dir = root.current.worldToLocal(tmpV.copy(L.lookAt)).sub(new THREE.Vector3(0, chestY, 0)).normalize();
      goals.push({ p: toWorld(dir.x * 0.6 - 0.12, chestY + 0.05 + dir.y * 0.5, dir.z * 0.6), w: L.pointWeight * 0.9 });
    }
    if (L.reachWeight > 0.01) goals.push({ p: L.reachTarget.clone(), w: L.reachWeight });
    if (L.presentWeight > 0.01) goals.push({ p: toWorld(-0.1, chestY - 0.05, 0.36), w: L.presentWeight });

    let wR = 0;
    handTargetR.set(0, 0, 0);
    for (const g of goals) {
      handTargetR.addScaledVector(g.p, g.w);
      wR += g.w;
    }
    if (wR > 0) handTargetR.divideScalar(wR);
    solveArm(armR, ch, handTargetR, P.upper, P.fore, Math.min(1, wR), rest.upperR, rest.foreR);

    // left hand supports the book when presenting
    const wL = L.presentWeight;
    handTargetL.copy(toWorld(0.1, chestY - 0.07, 0.34));
    solveArm(armL, ch, handTargetL, P.upper, P.fore, wL, rest.upperL, rest.foreL);

    root.current.updateMatrixWorld(true);
    armR.hand.getWorldPosition(L.handR);
    armL.hand.getWorldPosition(L.handL);
    head.current.getWorldPosition(L.chest);
    L.chest.y -= 0.35;
  });

  const limb = (len: number, rTop: number, rBot: number, mat: THREE.Material) => (
    <mesh position={[0, -len / 2, 0]} material={mat} castShadow>
      <cylinderGeometry args={[rTop, rBot, len, 14]} />
    </mesh>
  );

  const torsoLathe = useMemo(() => {
    const pts = female
      ? [
          [0.0, 0],
          [0.11, 0],
          [0.118, 0.05],
          [0.094, 0.19],
          [0.126, 0.31],
          [0.14, 0.38],
          [0.13, 0.45],
          [0.1, 0.49],
          [0.042, 0.515],
        ]
      : [
          [0.0, 0],
          [0.13, 0],
          [0.135, 0.1],
          [0.14, 0.25],
          [0.165, 0.42],
          [0.15, 0.52],
          [0.06, 0.56],
        ];
    const g = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 36);
    g.scale(1.25, 1, 0.78);
    // open-front cardigan / jacket layer following the same silhouette
    const outer = new THREE.LatheGeometry(
      pts.slice(1, -1).map(([x, y]) => new THREE.Vector2(x * 1.07 + 0.004, y)),
      36,
      0.42,
      Math.PI * 2 - 0.84,
    );
    outer.scale(1.25, 1, 0.78);
    return { body: g, outer };
  }, [female]);
  const skirtGeo = useMemo(() => {
    // gently flared A-line skirt with a soft hem
    const prof = [
      [0.128, 0.02],
      [0.14, -0.08],
      [0.17, -0.25],
      [0.21, -0.45],
      [0.245, -0.62],
      [0.262, -0.71],
      [0.255, -0.73],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const g = new THREE.LatheGeometry(prof, 48);
    g.scale(1.18, 1, 0.92);
    return g;
  }, []);
  const outerMat = useMemo(() => {
    const m = M.outfit.clone();
    m.side = THREE.DoubleSide;
    return m;
  }, [M]);

  const Arm = ({ side }: { side: 1 | -1 }) => {
    const upper = useRef<THREE.Group>(null);
    const fore = useRef<THREE.Group>(null);
    const hand = useRef<THREE.Group>(null);
    return (
      <group
        ref={(g) => {
          if (g && upper.current && fore.current && hand.current) arms.current[side === 1 ? 0 : 1] = { upper: upper.current, fore: fore.current, hand: hand.current, side };
        }}
      >
        <group ref={upper} position={[side * -P.shoulderW, P.torso - 0.06, 0]}>
          <mesh material={M.outfit} castShadow>
            <sphereGeometry args={[0.043, 14, 10]} />
          </mesh>
          {limb(P.upper, 0.046, 0.04, M.outfit)}
          <group ref={fore} position={[0, -P.upper, 0]}>
            {limb(P.fore, 0.038, 0.03, M.outfit)}
            <mesh position={[0, -P.fore + 0.02, 0]} material={M.shirt}>
              <cylinderGeometry args={[0.033, 0.033, 0.03, 12]} />
            </mesh>
            <group ref={hand} position={[0, -P.fore - 0.05, 0]}>
              {/* palm + four fingers + thumb */}
              <mesh position={[0, 0.012, 0]} material={M.skin} castShadow scale={[0.85, 1, 0.42]}>
                <sphereGeometry args={[0.034, 12, 10]} />
              </mesh>
              {[-0.018, -0.006, 0.006, 0.018].map((fx, k) => (
                <mesh key={k} position={[fx, -0.03 - (k === 1 || k === 2 ? 0.005 : 0), 0.004]} material={M.skin}>
                  <capsuleGeometry args={[0.0065, 0.035, 3, 6]} />
                </mesh>
              ))}
              <mesh position={[side * -0.028, 0.0, 0.014]} rotation-z={side * 0.7} rotation-x={-0.4} material={M.skin}>
                <capsuleGeometry args={[0.0075, 0.028, 3, 6]} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    );
  };

  const Leg = ({ i }: { i: 0 | 1 }) => {
    const thigh = useRef<THREE.Group>(null);
    const shin = useRef<THREE.Group>(null);
    const foot = useRef<THREE.Group>(null);
    const side = i === 0 ? 1 : -1;
    return (
      <group
        ref={(g) => {
          if (g && thigh.current && shin.current && foot.current) legs.current[i] = { thigh: thigh.current, shin: shin.current, foot: foot.current };
        }}
      >
        <group ref={thigh} position={[side * -P.hipW, 0, 0]}>
          {limb(P.thigh, 0.07, 0.052, M.trousers)}
          <group ref={shin} position={[0, -P.thigh, 0]}>
            {limb(P.shin, 0.05, 0.038, female ? M.skin : M.trousers)}
            <group ref={foot} position={[0, -P.shin, 0]}>
              <mesh position={[0, -0.03, 0.045]} material={M.shoe} castShadow>
                <boxGeometry args={[0.085, 0.06, 0.24]} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    );
  };

  return (
    <group ref={root}>
      <group ref={hips}>
        <Leg i={0} />
        <Leg i={1} />
        {female && (
          <mesh ref={skirt} geometry={skirtGeo} material={outerMat} castShadow />
        )}
        <mesh position={[0, 0.0, 0]} material={female ? M.outfit : M.trousers} castShadow scale={[1.25, 0.7, 0.85]}>
          <sphereGeometry args={[0.125, 18, 12]} />
        </mesh>
        <group ref={spine}>
          <group ref={chest}>
            <mesh geometry={torsoLathe.body} material={M.shirt} castShadow />
            <mesh geometry={torsoLathe.outer} material={outerMat} castShadow />
            {female ? (
              <>
                {/* belt + necklace with pendant */}
                <mesh position={[0, 0.02, 0]} rotation-x={Math.PI / 2} scale={[1.25, 0.8, 1]} material={M.badge}>
                  <torusGeometry args={[0.112, 0.006, 6, 40]} />
                </mesh>
                <mesh position={[0, P.torso - 0.035, 0.012]} rotation-x={Math.PI / 2 - 0.35} material={M.badge}>
                  <torusGeometry args={[0.052, 0.0022, 6, 36]} />
                </mesh>
                <mesh position={[0, P.torso - 0.075, 0.07]} material={M.badge}>
                  <octahedronGeometry args={[0.009, 0]} />
                </mesh>
              </>
            ) : (
              <>
                {/* tie, waistcoat buttons, collar, pocket square */}
                <mesh position={[0, 0.33, 0.112]} rotation-x={-0.14} material={M.tie}>
                  <boxGeometry args={[0.032, 0.26, 0.008]} />
                </mesh>
                <mesh position={[0, 0.47, 0.105]} rotation-x={-0.3} material={M.tie}>
                  <boxGeometry args={[0.03, 0.025, 0.02]} />
                </mesh>
                {[0, 1, 2, 3].map((i) => (
                  <mesh key={i} position={[0.03, 0.14 + i * 0.07, 0.126]} material={M.badge}>
                    <sphereGeometry args={[0.006, 8, 6]} />
                  </mesh>
                ))}
                {[-1, 1].map((sd) => (
                  <mesh key={sd} position={[sd * 0.032, 0.5, 0.075]} rotation={[-0.6, 0, sd * 0.9]} material={M.shirt}>
                    <coneGeometry args={[0.022, 0.05, 3]} />
                  </mesh>
                ))}
                <mesh position={[-0.105, 0.39, 0.112]} rotation-z={0.15} material={M.tie}>
                  <boxGeometry args={[0.04, 0.018, 0.006]} />
                </mesh>
              </>
            )}
            {/* name badge */}
            <mesh position={[0.085, 0.36, 0.13]} material={M.badge}>
              <boxGeometry args={[0.05, 0.016, 0.004]} />
            </mesh>
            <Arm side={1} />
            <Arm side={-1} />
            <group ref={neck} position={[0, P.torso, 0]}>
              <mesh position={[0, 0.025, 0]} material={M.skin} castShadow>
                <cylinderGeometry args={female ? [0.034, 0.041, 0.085, 18] : [0.042, 0.049, 0.085, 18]} />
              </mesh>
              <group ref={head} position={[0, 0.062, 0]}>
                <LibrarianHead ref={jaw} look={look} r={P.headR} eyesRef={eyes} skinMat={M.skin} hairMat={M.hair} />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
