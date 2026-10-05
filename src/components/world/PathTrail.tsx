"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { rt } from "@/lib/world/runtime";
import type { WalkPath } from "@/lib/world/nav";

/** A glowing guidance trail on the floor showing where the librarian is leading you. */
export function PathTrail() {
  const [path, setPath] = useState<WalkPath | null>(null);
  const mat = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 8;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 64, 0);
    grad.addColorStop(0, "rgba(120,220,255,0)");
    grad.addColorStop(0.5, "rgba(140,230,255,1)");
    grad.addColorStop(1, "rgba(120,220,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 8);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, color: "#8fe6ff" });
  }, []);
  const geo = useMemo(() => {
    if (!path) return null;
    const pts: THREE.Vector3[] = [];
    const n = Math.max(8, Math.ceil(path.length * 3));
    for (let i = 0; i <= n; i++) pts.push(path.at((i / n) * path.length).setY(0.03));
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.TubeGeometry(curve, n, 0.035, 4, false);
    tube.scale(1, 0.15, 1);
    if (mat.map) mat.map.repeat.set(path.length * 1.5, 1);
    return tube;
  }, [path, mat]);
  const last = useRef<WalkPath | null>(null);
  useFrame((_, dt) => {
    if (rt.lib.path !== last.current) {
      last.current = rt.lib.path;
      if (rt.lib.path) setPath(rt.lib.path);
    }
    const active = rt.lib.action === "walk";
    mat.opacity = THREE.MathUtils.damp(mat.opacity, active ? 0.75 : 0, 3, dt);
    if (mat.map) mat.map.offset.x -= dt * 1.2;
  });
  if (!geo) return null;
  return <mesh geometry={geo} material={mat} />;
}
