"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { easing } from "maath";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { SearchHit, SectionId } from "@/lib/types";
import { LAYOUT, sectionSide, sectionZ, slotU, slotWorld, uToX } from "@/lib/world/layout";
import { planPath, WalkPath } from "@/lib/world/nav";
import { rt, type LibAction } from "@/lib/world/runtime";
import { greetingFor, useLibrary, type Phase } from "@/store/useLibrary";
import { bookDims, bookFrontOffset } from "./FeaturedBook";

/**
 * Journey Director — the state machine that choreographs the experience:
 * gate → opening → entering → greeting → idle ⇄ thinking → walking → fetching → presenting
 * It drives `rt` (librarian behaviour channels, book transform) every frame;
 * the camera rig and avatar simply follow.
 */

type FetchStep = "turn" | "scan" | "reach" | "pull" | "take" | "done";

const DUR: Record<FetchStep, number> = { turn: 0.7, scan: 1.4, reach: 0.9, pull: 0.8, take: 1.0, done: 0 };
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const yawTo = (from: THREE.Vector3, to: THREE.Vector3) => Math.atan2(to.x - from.x, to.z - from.z);
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function Director() {
  const { camera } = useThree();
  const phaseT = useRef(0);
  const lastPhase = useRef<Phase>("gate");
  const job = useRef<{ kind: "fetch" | "goto"; hit?: SearchHit; section?: SectionId; step: FetchStep; t: number } | null>(null);
  const pendingFetch = useRef<number>(0);
  const pendingGoto = useRef<number>(0);
  const bookStart = useRef({ pos: new THREE.Vector3(), quat: new THREE.Quaternion() });
  const handQuat = useRef(new THREE.Quaternion());
  const greeted = useRef(false);

  // queue jobs from the store
  useEffect(
    () =>
      useLibrary.subscribe((s, prev) => {
        if (s.fetchNonce !== prev.fetchNonce) pendingFetch.current = s.fetchNonce;
        if (s.goSection && s.goSection.nonce !== prev.goSection?.nonce) pendingGoto.current = s.goSection.nonce;
      }),
    [],
  );

  const setAction = (a: LibAction) => {
    if (rt.lib.action !== a) {
      rt.lib.action = a;
      rt.lib.actionT = 0;
    }
  };

  const startWalk = (goal: THREE.Vector3, section: SectionId | null) => {
    const pts = planPath(rt.lib.pos, goal, section);
    rt.lib.path = new WalkPath(pts);
    rt.lib.pathDist = 0;
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, rt.dtMax);
    const store = useLibrary.getState();
    const phase = store.phase;
    if (phase !== lastPhase.current) {
      lastPhase.current = phase;
      phaseT.current = 0;
    }
    phaseT.current += dt;
    rt.lib.actionT += dt;
    const L = rt.lib;
    const camPos = camera.position;

    // ---------------------------------------------------------- intro
    if (phase === "gate" || phase === "opening" || phase === "entering") {
      setAction("idle");
      L.lookAt.set(camPos.x, camPos.y, camPos.z);
      L.targetYaw = 0;
      if (phase === "opening" && phaseT.current > 2.0) store.setPhase("entering");
      if (phase === "entering" && phaseT.current > 4.6) store.setPhase("greeting");
    }

    if (phase === "greeting") {
      if (!greeted.current) {
        greeted.current = true;
        store.say(greetingFor(store.lang, store.librarian.name, store.librarian.gender), store.lang);
      }
      setAction(phaseT.current < 2.6 ? "wave" : "idle");
      L.lookAt.copy(camPos);
      L.targetYaw = yawTo(L.pos, camPos);
      if (phaseT.current > 3.2) store.setPhase("idle");
    }

    if (phase === "idle" || phase === "presenting" || phase === "thinking") {
      if (!job.current) {
        L.lookAt.copy(camPos);
        L.targetYaw = yawTo(L.pos, camPos);
        if (phase === "thinking") setAction("think");
        else if (phase === "presenting") setAction(store.pending ? "think" : "present");
        else setAction("idle");
      }
    }

    // ---------------------------------------------------------- job start
    if (!job.current && pendingFetch.current && (phase !== "thinking" || phaseT.current > 1.1) && phase !== "walking" && phase !== "fetching") {
      pendingFetch.current = 0;
      const hit = store.target;
      if (hit) {
        const w = slotWorld(hit.location);
        const stand = new THREE.Vector3(w.x + sectionSide(hit.location.section) * -0.15, 0, w.standZ);
        startWalk(stand, hit.location.section);
        rt.book.loc = hit.location;
        rt.book.stage = 0;
        rt.book.visible = false;
        rt.book.highlight = 0;
        store.setHeld(null);
        job.current = { kind: "fetch", hit, step: "turn", t: 0 };
        store.setPhase("walking");
        setAction("walk");
      }
    }
    if (!job.current && pendingGoto.current && phase !== "walking" && phase !== "fetching") {
      pendingGoto.current = 0;
      const sec = store.goSection?.id;
      if (sec) {
        const goal = new THREE.Vector3(uToX(sec, slotU(1, LAYOUT.SLOTS / 2)), 0, sectionZ(sec));
        startWalk(goal, sec);
        job.current = { kind: "goto", section: sec, step: "done", t: 0 };
        store.setPhase("walking");
        setAction("walk");
      }
    }

    // ---------------------------------------------------------- walking
    if (phase === "walking" && L.path) {
      const remaining = L.path.length - L.pathDist;
      const vmax = 1.35;
      const want = remaining < 0.8 ? Math.max(0.25, remaining * 1.4) : vmax;
      easing.damp(L, "speed", want, 0.35, dt);
      L.pathDist = Math.min(L.path.length, L.pathDist + L.speed * dt);
      L.path.at(L.pathDist, L.pos);
      const tan = L.path.tangent(L.pathDist);
      if (tan.lengthSq() > 1e-6) L.targetYaw = Math.atan2(tan.x, tan.z);
      // look ahead, glancing back at the user now and then
      const ahead = L.path.at(Math.min(L.path.length, L.pathDist + 2.5)).setY(1.5);
      const glance = Math.sin(phaseT.current * 0.7) > 0.85;
      L.lookAt.lerp(glance ? camPos : ahead, 0.1);
      setAction("walk");
      if (remaining < 0.02) {
        L.speed = 0;
        if (job.current?.kind === "fetch") {
          job.current.step = "turn";
          job.current.t = 0;
          store.setPhase("fetching");
        } else {
          job.current = null;
          store.setPhase(store.heldBook ? "presenting" : "idle");
        }
      }
    } else if (phase !== "walking") {
      easing.damp(L, "speed", 0, 0.2, dt);
    }

    // ---------------------------------------------------------- fetching
    if (phase === "fetching" && job.current?.kind === "fetch" && job.current.hit) {
      const j = job.current;
      const hit = j.hit!;
      const loc = hit.location;
      const w = slotWorld(loc);
      const dims = bookDims(hit.book);
      const shelfPos = new THREE.Vector3(w.x, w.y, w.z + w.facing * bookFrontOffset(dims.d));
      const shelfQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), w.facing > 0 ? 0 : Math.PI);
      const spinePoint = shelfPos.clone().add(new THREE.Vector3(0, dims.h * 0.6, w.facing * dims.d * 0.5));
      j.t += dt;
      const p = Math.min(1, j.t / DUR[j.step]);
      const faceShelf = w.facing > 0 ? Math.PI : 0;
      const lowShelf = THREE.MathUtils.clamp((0.75 - w.y) / 0.6, 0, 1);

      switch (j.step) {
        case "turn":
          setAction("idle");
          L.targetYaw = faceShelf;
          L.lookAt.lerp(spinePoint, 0.15);
          if (p >= 1) next("scan");
          break;
        case "scan": {
          setAction("scan");
          const sweep = new THREE.Vector3(w.x + sectionSide(loc.section) * (0.9 - 1.8 * ease(p)), w.y + 0.15 + Math.sin(p * Math.PI) * 0.2, shelfPos.z);
          L.lookAt.copy(p < 0.75 ? sweep : spinePoint);
          rt.book.highlight = THREE.MathUtils.clamp((p - 0.55) / 0.45, 0, 1);
          easing.damp(L, "crouch", lowShelf * 0.9, 0.4, dt);
          if (p >= 1) next("reach");
          break;
        }
        case "reach":
          setAction("reach");
          L.lookAt.copy(spinePoint);
          L.reachTarget.copy(spinePoint);
          L.reachWeight = ease(p);
          easing.damp(L, "crouch", lowShelf, 0.3, dt);
          rt.book.highlight = 1;
          if (p >= 1) {
            rt.book.stage = 1;
            rt.book.visible = true;
            rt.book.pos.copy(shelfPos);
            rt.book.quat.copy(shelfQuat);
            next("pull");
          }
          break;
        case "pull": {
          const out = ease(p) * (dims.d * 0.85);
          rt.book.pos.copy(shelfPos).add(new THREE.Vector3(0, 0.005, w.facing * out));
          rt.book.quat.copy(shelfQuat);
          L.reachTarget.copy(rt.book.pos).add(new THREE.Vector3(0, dims.h * 0.6, w.facing * dims.d * 0.5));
          L.reachWeight = 1;
          rt.book.highlight = 1 - p * 0.6;
          if (p >= 1) {
            bookStart.current.pos.copy(rt.book.pos);
            bookStart.current.quat.copy(rt.book.quat);
            rt.book.stage = 2;
            next("take");
          }
          break;
        }
        case "take": {
          // stand up, turn to the user and hold the book out
          setAction("present");
          L.reachWeight = 1 - ease(p);
          easing.damp(L, "crouch", 0, 0.25, dt);
          L.targetYaw = yawTo(L.pos, camPos);
          L.lookAt.copy(camPos);
          rt.book.highlight = Math.max(0, rt.book.highlight - dt * 2);
          const hands = presentPose();
          const k = ease(Math.min(1, p * 1.2));
          rt.book.pos.lerpVectors(bookStart.current.pos, hands.pos, k);
          rt.book.quat.slerpQuaternions(bookStart.current.quat, hands.quat, k);
          if (p >= 1) {
            job.current = null;
            store.setHeld(hit.book);
            store.setPhase("presenting");
          }
          break;
        }
      }
      function next(s: FetchStep) {
        j.step = s;
        j.t = 0;
      }
    }

    // ---------------------------------------------------------- book in hands
    if (!job.current && rt.book.stage === 2 && store.heldBook) {
      const hands = presentPose();
      if (L.action === "present") {
        rt.book.pos.lerp(hands.pos, 0.35);
        rt.book.quat.slerp(hands.quat, 0.35);
      } else {
        // carried in the left hand while thinking / talking
        const carry = L.handL.clone().add(new THREE.Vector3(0, -0.12, 0));
        rt.book.pos.lerp(carry, 0.3);
        handQuat.current.setFromAxisAngle(new THREE.Vector3(0, 1, 0), L.yaw + Math.PI / 2);
        rt.book.quat.slerp(handQuat.current, 0.3);
      }
    }

    // ---------------------------------------------------------- turn smoothing
    const dy = wrapAngle(L.targetYaw - L.yaw);
    L.yaw += dy * Math.min(1, dt * (phase === "walking" ? 6 : 4));
    L.forward.set(Math.sin(L.yaw), 0, Math.cos(L.yaw));
    if (phase !== "fetching") {
      easing.damp(L, "crouch", 0, 0.3, dt);
      if (!(phase === "presenting" || job.current)) L.reachWeight = Math.max(0, L.reachWeight - dt * 2);
    }
  });

  return null;
}

/** Book pose held out in front of the librarian, front cover toward the user. */
function presentPose() {
  const L = rt.lib;
  const mid = L.handR.clone().add(L.handL).multiplyScalar(0.5);
  const pos = mid.add(new THREE.Vector3(0, -0.11, 0)).add(L.forward.clone().multiplyScalar(0.03));
  // book +x (front cover) → librarian forward, tilted back a little
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), L.yaw - Math.PI / 2);
  const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.18);
  return { pos, quat: q.multiply(tilt) };
}
