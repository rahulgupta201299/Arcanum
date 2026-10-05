import * as THREE from "three";
import type { ShelfLocation } from "../types";
import type { WalkPath } from "./nav";

/**
 * Per-frame mutable world state shared between the director, the librarian
 * rig, the camera and the audio engine. Kept outside React to avoid
 * re-renders at 60 FPS (React state lives in the zustand store).
 */
export type LibAction =
  | "idle"
  | "wave"
  | "think"
  | "walk"
  | "turn"
  | "scan"
  | "reach"
  | "pull"
  | "present"
  | "point";

export const rt = {
  lib: {
    pos: new THREE.Vector3(1.6, 0, -5.2),
    yaw: 0, // 0 = facing +z (towards the entrance)
    targetYaw: 0,
    speed: 0,
    walkCycle: 0,
    path: null as WalkPath | null,
    pathDist: 0,
    action: "idle" as LibAction,
    actionT: 0,
    lookAt: new THREE.Vector3(0, 1.6, 2),
    crouch: 0,
    reachTarget: new THREE.Vector3(),
    reachWeight: 0,
    presentWeight: 0,
    thinkWeight: 0,
    waveWeight: 0,
    pointWeight: 0,
    speaking: false,
    mouth: 0,
    handR: new THREE.Vector3(),
    handL: new THREE.Vector3(),
    chest: new THREE.Vector3(),
    forward: new THREE.Vector3(0, 0, 1),
  },
  book: {
    loc: null as ShelfLocation | null,
    visible: false,
    highlight: 0,
    /** 0 on shelf → 1 pulled out → 2 in hand */
    stage: 0,
    pos: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
  },
  cam: {
    focus: new THREE.Vector3(0, 1.5, -5),
    userYaw: 0,
    userPitch: 0,
  },
  /** footstep events for the audio engine */
  footstep: 0,
  /** max simulated seconds per frame (raised by ?speed= for automated tests on slow GPUs) */
  dtMax: 0.05,
  sectionUnderCamera: 0,
};

export function resetRuntime() {
  rt.lib.pos.set(1.6, 0, -5.2);
  rt.lib.yaw = 0;
  rt.lib.targetYaw = 0;
  rt.lib.path = null;
  rt.lib.action = "idle";
  rt.book.loc = null;
  rt.book.visible = false;
  rt.book.stage = 0;
}
