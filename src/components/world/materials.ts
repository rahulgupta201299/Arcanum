"use client";

import * as THREE from "three";
import { parquetTexture, plasterTexture, woodTexture } from "@/lib/world/textures";

/** Shared, lazily-created materials (one instance each → fewer shader programs). */
let M: ReturnType<typeof make> | null = null;

function make() {
  const wood = woodTexture("#3d2312", "shelfwood");
  const woodLight = woodTexture("#6b4527", "lightwood");
  const floorTex = parquetTexture();
  const plaster = plasterTexture();
  return {
    shelfWood: new THREE.MeshStandardMaterial({ map: wood, color: "#a87a55", roughness: 0.62, metalness: 0.02 }),
    trimWood: new THREE.MeshStandardMaterial({ map: woodLight, color: "#c49b6c", roughness: 0.5 }),
    deskWood: new THREE.MeshPhysicalMaterial({ map: wood, color: "#b5835a", roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
    floor: new THREE.MeshStandardMaterial({ map: floorTex, color: "#c8a07a", roughness: 0.38, metalness: 0.0 }),
    plaster: new THREE.MeshStandardMaterial({ map: plaster, color: "#efe3cc", roughness: 0.92 }),
    stone: new THREE.MeshStandardMaterial({ map: plasterTexture("#bdb4a4"), color: "#c9c0ae", roughness: 0.85 }),
    darkStone: new THREE.MeshStandardMaterial({ color: "#2b2622", roughness: 0.8 }),
    brass: new THREE.MeshStandardMaterial({ color: "#c79a4a", roughness: 0.28, metalness: 0.9 }),
    bulb: new THREE.MeshStandardMaterial({ color: "#ffe2a8", emissive: "#ffc46b", emissiveIntensity: 3.2, toneMapped: false }),
    glassGlow: new THREE.MeshStandardMaterial({ color: "#ffd9a0", emissive: "#ffb85c", emissiveIntensity: 1.6, transparent: true, opacity: 0.9, toneMapped: false }),
    moonGlass: new THREE.MeshStandardMaterial({ color: "#9fb6d8", emissive: "#5d7fb8", emissiveIntensity: 0.9, toneMapped: false }),
    rug: new THREE.MeshStandardMaterial({ color: "#5a1d1d", roughness: 1 }),
    rugBorder: new THREE.MeshStandardMaterial({ color: "#b0893d", roughness: 0.9 }),
    leather: new THREE.MeshStandardMaterial({ color: "#3b1f14", roughness: 0.55 }),
    plant: new THREE.MeshStandardMaterial({ color: "#2f5a2a", roughness: 0.8 }),
    ceiling: new THREE.MeshStandardMaterial({ color: "#3a2a1d", roughness: 0.9, map: wood }),
  };
}

export function mats() {
  return (M ??= make());
}
