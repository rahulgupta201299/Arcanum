"use client";

import { forwardRef, useMemo } from "react";
import * as THREE from "three";

export interface HeadLook {
  female: boolean;
  skin: string;
  hair: string;
  eyes: string;
  lips: string;
  hairStyle: "long" | "bun" | "bob" | "quiff" | "side";
  glasses: boolean;
  stubble: boolean;
}

interface Props {
  look: HeadLook;
  r: number; // head radius
  eyesRef: React.Ref<THREE.Group>;
  skinMat: THREE.Material;
  hairMat: THREE.Material;
}

/**
 * A softer, more expressive stylised face: egg-shaped face with tapered chin,
 * large eyes with iris + pupil + catch-light, lashes, arched brows, shaped
 * lips, blush, refined nose and several hairstyles.
 * The forwarded ref is the dark mouth opening (scaled for lip-sync).
 */
export const LibrarianHead = forwardRef<THREE.Mesh, Props>(function LibrarianHead({ look, r, eyesRef, skinMat, hairMat }, mouthRef) {
  const M = useMemo(
    () => ({
      eyeW: new THREE.MeshPhysicalMaterial({ color: "#fbf8f2", roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }),
      iris: new THREE.MeshStandardMaterial({ color: look.eyes, roughness: 0.25 }),
      pupil: new THREE.MeshBasicMaterial({ color: "#0b0705" }),
      catch: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
      lash: new THREE.MeshStandardMaterial({ color: "#120b08", roughness: 0.6 }),
      brow: new THREE.MeshStandardMaterial({ color: look.hair, roughness: 0.8 }),
      lip: new THREE.MeshPhysicalMaterial({ color: look.lips, roughness: 0.38, clearcoat: look.female ? 0.6 : 0.1, clearcoatRoughness: 0.3 }),
      mouth: new THREE.MeshStandardMaterial({ color: "#3a1414", roughness: 0.9 }),
      blush: new THREE.MeshStandardMaterial({ color: "#ff8f86", transparent: true, opacity: look.female ? 0.22 : 0.08, roughness: 1, depthWrite: false }),
      stubble: new THREE.MeshStandardMaterial({ color: "#1f1712", transparent: true, opacity: 0.12, roughness: 1, depthWrite: false }),
      frame: new THREE.MeshStandardMaterial({ color: "#c9a253", metalness: 0.9, roughness: 0.22 }),
      lens: new THREE.MeshPhysicalMaterial({ color: "#ffffff", transmission: 0.95, roughness: 0.04, transparent: true, opacity: 0.18 }),
      earring: new THREE.MeshStandardMaterial({ color: "#e7c26b", metalness: 1, roughness: 0.18 }),
    }),
    [look],
  );
  const f = look.female;
  const faceZ = r * 0.86;

  return (
    <group>
      {/* cranium */}
      <mesh position={[0, 0.108, -0.006]} material={skinMat} scale={[0.9, 1, 0.98]} castShadow>
        <sphereGeometry args={[r, 40, 30]} />
      </mesh>
      {/* face: egg with tapered chin */}
      <mesh position={[0, 0.07, 0.016]} material={skinMat} scale={[f ? 0.8 : 0.86, 1.12, 0.86]} castShadow>
        <sphereGeometry args={[r * 0.88, 40, 30]} />
      </mesh>
      <mesh position={[0, 0.016, 0.042]} material={skinMat} scale={[f ? 0.9 : 1.1, 0.7, 0.7]}>
        <sphereGeometry args={[r * 0.28, 20, 14]} />
      </mesh>
      {/* soft blush (kept inside the face surface) */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.043, 0.064, 0.062]} material={M.blush} scale={[1, 0.62, 0.28]}>
          <sphereGeometry args={[r * 0.2, 16, 10]} />
        </mesh>
      ))}
      {look.stubble && (
        <mesh position={[0, 0.04, 0.03]} material={M.stubble} scale={[0.86, 0.75, 0.9]}>
          <sphereGeometry args={[r * 0.9, 32, 20, 0, Math.PI * 2, Math.PI * 0.58, Math.PI * 0.38]} />
        </mesh>
      )}
      {/* ears */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * r * 0.88, 0.09, -0.004]}>
          <mesh material={skinMat} scale={[0.42, 1, 0.72]}>
            <sphereGeometry args={[0.024, 14, 10]} />
          </mesh>
          {f && (
            <mesh position={[0, -0.03, 0.002]} material={M.earring}>
              <sphereGeometry args={[0.0055, 10, 8]} />
            </mesh>
          )}
        </group>
      ))}
      {/* nose: bridge + tip + soft wings */}
      <mesh position={[0, 0.088, faceZ + 0.004]} rotation-x={0.42} material={skinMat}>
        <capsuleGeometry args={[0.0065, 0.03, 4, 10]} />
      </mesh>
      <mesh position={[0, 0.07, faceZ + 0.014]} material={skinMat} scale={[1.1, 0.9, 1]}>
        <sphereGeometry args={[0.0105, 14, 10]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.0105, 0.0675, faceZ + 0.006]} material={skinMat}>
          <sphereGeometry args={[0.0072, 10, 8]} />
        </mesh>
      ))}
      {/* eyes */}
      <group ref={eyesRef} position={[0, 0.1, faceZ - 0.006]}>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.031, 0, 0]}>
            <mesh material={M.eyeW} scale={[1.12, 0.82, 0.62]}>
              <sphereGeometry args={[0.0145, 20, 14]} />
            </mesh>
            <mesh position={[0, -0.0005, 0.0092]} material={M.iris}>
              <circleGeometry args={[0.0078, 24]} />
            </mesh>
            <mesh position={[0, -0.0005, 0.0094]} material={M.pupil}>
              <circleGeometry args={[0.0036, 18]} />
            </mesh>
            <mesh position={[0.0028, 0.0028, 0.0097]} material={M.catch}>
              <circleGeometry args={[0.0014, 10]} />
            </mesh>
            {/* upper lid crease + lashes */}
            <mesh position={[0, 0.0015, 0.003]} rotation-z={0.08 * s} material={M.lash} scale={[1.12, 0.78, 1]}>
              <torusGeometry args={[0.0148, f ? 0.0017 : 0.0011, 6, 20, Math.PI]} />
            </mesh>
            {f && (
              <mesh position={[s * 0.016, 0.006, 0.004]} rotation-z={s * -0.6} material={M.lash}>
                <capsuleGeometry args={[0.0012, 0.006, 3, 6]} />
              </mesh>
            )}
          </group>
        ))}
      </group>
      {/* brows: soft arches */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.032, 0.114, faceZ + 0.004]} rotation={[0, 0, Math.PI * 0.1 + s * 0.07]} material={M.brow} scale={[1.15, 0.5, 1]}>
          <torusGeometry args={[0.019, f ? 0.0022 : 0.0034, 6, 18, Math.PI * 0.8]} />
        </mesh>
      ))}
      {/* lips + mouth */}
      <mesh position={[0, 0.042, faceZ + 0.002]} material={M.lip} scale={[1.3, f ? 0.36 : 0.28, 0.55]}>
        <sphereGeometry args={[0.0155, 20, 12]} />
      </mesh>
      <mesh position={[0, 0.0315, faceZ - 0.001]} material={M.lip} scale={[1.15, f ? 0.48 : 0.38, 0.6]}>
        <sphereGeometry args={[0.0145, 20, 12]} />
      </mesh>
      {/* gentle smile corners */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.0205, 0.0385, faceZ - 0.006]} rotation-z={s * 0.5} material={M.mouth} scale={[1, 0.35, 0.5]}>
          <sphereGeometry args={[0.0028, 8, 6]} />
        </mesh>
      ))}
      <mesh ref={mouthRef} position={[0, 0.0365, faceZ + 0.003]} material={M.mouth} scale={[0.85, 0.15, 0.3]}>
        <sphereGeometry args={[0.0165, 16, 10]} />
      </mesh>
      {/* glasses */}
      {look.glasses && (
        <group position={[0, 0.1, faceZ + 0.016]}>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.032, 0, 0]}>
              <mesh material={M.frame} scale={[1.1, 0.92, 1]}>
                <torusGeometry args={[0.0195, 0.0013, 6, 28]} />
              </mesh>
              <mesh material={M.lens} scale={[1.1, 0.92, 1]}>
                <circleGeometry args={[0.0195, 20]} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 0.003, 0]} material={M.frame} rotation-z={Math.PI / 2}>
            <torusGeometry args={[0.006, 0.0012, 4, 10, Math.PI]} />
          </mesh>
        </group>
      )}
      <Hair look={look} r={r} mat={hairMat} />
    </group>
  );
});

function Hair({ look, r, mat }: { look: HeadLook; r: number; mat: THREE.Material }) {
  const cap = (theta: number, y = 0.118, sc: [number, number, number] = [0.97, 0.98, 1.05], tilt = -0.38) => (
    <mesh position={[0, y, -0.014]} rotation-x={tilt} material={mat} scale={sc} castShadow>
      <sphereGeometry args={[r * 1.06, 36, 24, 0, Math.PI * 2, 0, Math.PI * theta]} />
    </mesh>
  );
  // swept fringe across the forehead
  const fringe = (side: 1 | -1) => (
    <mesh position={[side * 0.022, 0.168, 0.028]} rotation={[0.7, 0, side * -0.5]} material={mat} scale={[1.2, 0.34, 0.85]} castShadow>
      <sphereGeometry args={[r * 0.58, 24, 14]} />
    </mesh>
  );
  const sideburns = [-1, 1].map((s) => (
    <mesh key={s} position={[s * r * 0.86, 0.085, 0.012]} material={mat} scale={[0.35, 1, 0.6]}>
      <sphereGeometry args={[0.022, 10, 8]} />
    </mesh>
  ));
  switch (look.hairStyle) {
    case "long":
      return (
        <group>
          {cap(0.56)}
          {fringe(1)}
          {/* back fall down to the shoulder blades */}
          <mesh position={[0, 0.0, -0.052]} material={mat} scale={[1.05, 1, 0.55]} castShadow>
            <capsuleGeometry args={[0.088, 0.24, 8, 20]} />
          </mesh>
          {/* face-framing locks */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.084, 0.03, 0.0]} rotation-z={s * 0.06} material={mat} scale={[0.75, 1, 0.9]} castShadow>
              <capsuleGeometry args={[0.03, 0.17, 6, 12]} />
            </mesh>
          ))}
        </group>
      );
    case "bob":
      return (
        <group>
          {cap(0.56)}
          {fringe(-1)}
          <mesh position={[0, 0.07, -0.01]} material={mat} scale={[1.08, 0.9, 1.05]} castShadow>
            <sphereGeometry args={[r * 1.12, 36, 24, 2.25, Math.PI * 2 - 1.36, Math.PI * 0.3, Math.PI * 0.42]} />
          </mesh>
        </group>
      );
    case "bun":
      return (
        <group>
          {cap(0.58)}
          {fringe(1)}
          <mesh position={[0, 0.17, -0.1]} material={mat} castShadow>
            <sphereGeometry args={[0.048, 20, 14]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.08, 0.05, 0.01]} material={mat} rotation-z={s * 0.1}>
              <capsuleGeometry args={[0.009, 0.08, 4, 8]} />
            </mesh>
          ))}
        </group>
      );
    case "quiff":
      return (
        <group>
          {cap(0.55, 0.118, [0.97, 0.94, 1.04], -0.62)}
          {sideburns}
          <mesh position={[0.004, 0.19, 0.035]} rotation={[0.5, 0, -0.2]} material={mat} scale={[1.7, 0.5, 1.1]} castShadow>
            <sphereGeometry args={[0.036, 20, 12]} />
          </mesh>
        </group>
      );
    default:
      return (
        <group>
          {cap(0.56, 0.118, [0.98, 0.94, 1.04], -0.6)}
          {sideburns}
          <mesh position={[-0.02, 0.19, 0.035]} rotation={[0.3, 0, 0.5]} material={mat} scale={[1.6, 0.5, 1]} castShadow>
            <sphereGeometry args={[0.04, 18, 12]} />
          </mesh>
        </group>
      );
  }
}
