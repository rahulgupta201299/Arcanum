"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { easing } from "maath";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { sectionSide, slotWorld } from "@/lib/world/layout";
import { rt } from "@/lib/world/runtime";
import { useLibrary } from "@/store/useLibrary";

/**
 * Cinematic camera director. The camera is the user's eyes: it frames the
 * gate, dollies through the doors, stands face-to-face with the librarian,
 * walks beside her, watches her take the book and receives it.
 * Drag (mouse / touch) to look around within limits; WASD/arrow keys move
 * freely while idle (explore mode).
 */
export function CameraRig() {
  const { camera, gl, size } = useThree();
  const look = useRef(new THREE.Vector3(0, 2.4, 0));
  const user = useRef(new THREE.Vector3(0, 0, 9.5)); // where the user stands (feet)
  const phaseT = useRef(0);
  const lastPhase = useRef("");
  const drag = useRef({ active: false, x: 0, y: 0, yaw: 0, pitch: 0 });
  const keys = useRef(new Set<string>());
  const presentAnchor = useRef<THREE.Vector3 | null>(null);
  const exploreBase = useRef<number | null>(null);

  const intro = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 1.75, 8.6),
        new THREE.Vector3(0, 1.85, 4.5),
        new THREE.Vector3(0, 1.8, 0.6),
        new THREE.Vector3(0.1, 1.7, -1.6),
        new THREE.Vector3(0.4, 1.64, -2.4),
      ]),
    [],
  );

  useEffect(() => {
    const el = gl.domElement;
    const down = (e: PointerEvent) => {
      drag.current.active = true;
      drag.current.x = e.clientX;
      drag.current.y = e.clientY;
    };
    const move = (e: PointerEvent) => {
      if (!drag.current.active) return;
      const d = drag.current;
      const free = useLibrary.getState().explore;
      d.yaw = free ? d.yaw - (e.clientX - d.x) * 0.004 : THREE.MathUtils.clamp(d.yaw - (e.clientX - d.x) * 0.004, -1.4, 1.4);
      d.pitch = THREE.MathUtils.clamp(d.pitch - (e.clientY - d.y) * 0.003, -0.5, 0.5);
      d.x = e.clientX;
      d.y = e.clientY;
    };
    const up = () => (drag.current.active = false);
    const kd = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      keys.current.add(e.key.toLowerCase());
    };
    const ku = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, [gl]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, rt.dtMax);
    const { phase, explore } = useLibrary.getState();
    if (phase !== lastPhase.current) {
      lastPhase.current = phase;
      phaseT.current = 0;
      if (phase !== "presenting") presentAnchor.current = null;
    }
    phaseT.current += dt;
    const L = rt.lib;
    const cam = camera as THREE.PerspectiveCamera;
    const portrait = size.width < size.height;
    const wantFov = portrait ? 68 : 50;
    if (Math.abs(cam.fov - wantFov) > 0.1) {
      cam.fov = THREE.MathUtils.damp(cam.fov, wantFov, 4, dt);
      cam.updateProjectionMatrix();
    }
    const head = L.pos.clone().setY(L.chest.y + 0.32 || 1.55);
    const eye = new THREE.Vector3();
    const target = new THREE.Vector3();
    let lambda = 0.45;

    switch (phase) {
      case "gate": {
        const t = state.clock.elapsedTime;
        eye.set(Math.sin(t * 0.15) * 0.4, 1.75 + Math.sin(t * 0.3) * 0.05, 9.2);
        target.set(0, 2.6, 0);
        break;
      }
      case "opening":
        eye.set(0, 1.75, 8.6);
        target.set(0, 2.3, 0);
        lambda = 0.8;
        break;
      case "entering": {
        const p = Math.min(1, phaseT.current / 4.6);
        const k = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        intro.getPointAt(k, eye);
        target.lerpVectors(new THREE.Vector3(0, 2.3, -4), head, Math.min(1, k * 1.4));
        lambda = 0.12;
        user.current.set(eye.x, 0, eye.z);
        break;
      }
      case "walking": {
        // walk beside & slightly behind the librarian
        const right = new THREE.Vector3(L.forward.z, 0, -L.forward.x).multiplyScalar(-1);
        const want = L.pos.clone().addScaledVector(L.forward, -1.9).addScaledVector(right, 0.65);
        easing.damp3(user.current, want, 0.55, dt);
        eye.copy(user.current).setY(1.64 + Math.sin(L.walkCycle * 2) * 0.012);
        target.copy(L.pos).addScaledVector(L.forward, 2.2).setY(1.35);
        lambda = 0.35;
        break;
      }
      case "fetching": {
        const loc = rt.book.loc;
        if (loc) {
          const w = slotWorld(loc);
          const side = sectionSide(loc.section);
          // stand in the cross-aisle, beside her and a little back towards the main aisle
          const want = new THREE.Vector3(w.x - side * 1.8, 0, w.standZ + w.facing * 1.15);
          easing.damp3(user.current, want, 0.7, dt);
          eye.copy(user.current).setY(1.6);
          const bookP = rt.book.stage > 0 ? rt.book.pos : new THREE.Vector3(w.x, w.y + 0.12, w.z);
          target.lerpVectors(head, bookP, 0.55);
        }
        lambda = 0.4;
        break;
      }
      case "presenting": {
        if (!presentAnchor.current) {
          const dir = camera.position.clone().sub(L.pos).setY(0);
          if (dir.lengthSq() < 0.01) dir.copy(L.forward);
          dir.normalize();
          presentAnchor.current = L.pos.clone().addScaledVector(dir, 1.25);
        }
        easing.damp3(user.current, presentAnchor.current, 0.5, dt);
        eye.copy(user.current).setY(1.52);
        target.copy(rt.book.stage === 2 ? rt.book.pos : head).add(new THREE.Vector3(0, 0.18, 0));
        target.lerp(head, 0.35);
        break;
      }
      default: {
        // greeting / idle / thinking: face-to-face conversation distance
        if (explore) {
          if (exploreBase.current === null) {
            exploreBase.current = Math.atan2(look.current.x - camera.position.x, look.current.z - camera.position.z);
            drag.current.yaw = 0;
          }
          const speed = 2.4 * dt;
          const yaw = exploreBase.current + drag.current.yaw * 2.2;
          const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
          const rgt = new THREE.Vector3(-fwd.z, 0, fwd.x);
          const k = keys.current;
          if (k.has("w") || k.has("arrowup")) user.current.addScaledVector(fwd, speed);
          if (k.has("s") || k.has("arrowdown")) user.current.addScaledVector(fwd, -speed);
          if (k.has("a") || k.has("arrowleft")) user.current.addScaledVector(rgt, -speed);
          if (k.has("d") || k.has("arrowright")) user.current.addScaledVector(rgt, speed);
          const halfW = user.current.z > -15.5 ? 11 : 2.3; // foyer is open; stay in the main aisle among shelves
          user.current.x = THREE.MathUtils.clamp(user.current.x, -halfW, halfW);
          user.current.z = THREE.MathUtils.clamp(user.current.z, -400, -0.5);
          eye.copy(user.current).setY(1.65);
          target.copy(eye).add(fwd.multiplyScalar(3)).setY(1.5);
          lambda = 0.15;
        } else {
          exploreBase.current = null;
          const toUser = user.current.clone().sub(L.pos).setY(0);
          const dist = toUser.length();
          if (dist < 1.8 || dist > 3.4) {
            toUser.normalize();
            if (!isFinite(toUser.x)) toUser.set(0, 0, 1);
            easing.damp3(user.current, L.pos.clone().addScaledVector(toUser, 2.4), 0.8, dt);
          }
          eye.copy(user.current).setY(1.64);
          target.copy(head).add(new THREE.Vector3(0, -0.08, 0));
          if (phase === "thinking") target.y += 0.15;
        }
      }
    }

    // user look-around (decays back to framing when not dragging)
    if (!drag.current.active && !explore) {
      drag.current.yaw = THREE.MathUtils.damp(drag.current.yaw, 0, 1.2, dt);
      drag.current.pitch = THREE.MathUtils.damp(drag.current.pitch, 0, 1.2, dt);
    }
    easing.damp3(camera.position, eye, lambda, dt);
    easing.damp3(look.current, target, lambda * 0.8, dt);
    const dir = look.current.clone().sub(camera.position);
    const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), explore ? 0 : drag.current.yaw);
    dir.applyQuaternion(yawQ);
    const lookPoint = camera.position.clone().add(dir);
    lookPoint.y += drag.current.pitch * dir.length();
    camera.lookAt(lookPoint);
  });

  return null;
}
