import * as THREE from "three";
import type { SectionId } from "../types";
import { LAYOUT, sectionSide, sectionZ, slotU, uToX } from "./layout";

/**
 * Navigation graph over the library's walkable aisles + A* search.
 * The graph is generated lazily as far as needed (the library is infinite).
 * Swap for recast-navigation (navmesh) if the floorplan becomes irregular.
 */
interface Node {
  id: string;
  p: THREE.Vector2; // (x, z)
  edges: Set<string>;
}

class NavGraph {
  nodes = new Map<string, Node>();
  private builtPairs = -1;

  constructor() {
    const foyer: [string, number, number][] = [
      ["desk", 1.6, -5.2],
      ["f0", 0, 1],
      ["f1", 0, -3],
      ["f2", 0, -8],
      ["f3", 0, -12],
      ["f4", 0, LAYOUT.FOYER_END_Z],
    ];
    for (const [id, x, z] of foyer) this.add(id, x, z);
    this.link("f0", "f1");
    this.link("f1", "f2");
    this.link("f2", "f3");
    this.link("f3", "f4");
    this.link("desk", "f1");
    this.link("desk", "f2");
  }

  private add(id: string, x: number, z: number) {
    if (!this.nodes.has(id)) this.nodes.set(id, { id, p: new THREE.Vector2(x, z), edges: new Set() });
    return this.nodes.get(id)!;
  }
  private link(a: string, b: string) {
    this.nodes.get(a)!.edges.add(b);
    this.nodes.get(b)!.edges.add(a);
  }

  /** Ensure graph covers sections up to `section`. */
  ensure(section: SectionId) {
    const pairs = Math.floor((section - 1) / 2);
    for (let k = this.builtPairs + 1; k <= pairs; k++) {
      const z = sectionZ(2 * k + 1);
      const m = `m${k}`;
      this.add(m, 0, z);
      this.link(m, k === 0 ? "f4" : `m${k - 1}`);
      for (const s of [2 * k + 1, 2 * k + 2]) {
        const entry = `s${s}e`;
        this.add(entry, uToX(s, 0.2), z);
        this.link(entry, m);
        let prev = entry;
        for (let b = 0; b < LAYOUT.BAYS; b++) {
          const id = `s${s}b${b}`;
          this.add(id, uToX(s, slotU(b, LAYOUT.SLOTS / 2)), z);
          this.link(id, prev);
          prev = id;
        }
      }
    }
    this.builtPairs = Math.max(this.builtPairs, pairs);
  }

  nearest(p: THREE.Vector2, filter?: (n: Node) => boolean) {
    let best: Node | null = null;
    let bd = Infinity;
    for (const n of this.nodes.values()) {
      if (filter && !filter(n)) continue;
      const d = n.p.distanceToSquared(p);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best!;
  }

  astar(start: string, goal: string): string[] {
    const g = new Map<string, number>([[start, 0]]);
    const f = new Map<string, number>([[start, this.h(start, goal)]]);
    const came = new Map<string, string>();
    const open = new Set([start]);
    while (open.size) {
      let cur = "";
      let best = Infinity;
      for (const id of open) {
        const v = f.get(id) ?? Infinity;
        if (v < best) {
          best = v;
          cur = id;
        }
      }
      if (cur === goal) {
        const path = [cur];
        while (came.has(cur)) path.unshift((cur = came.get(cur)!));
        return path;
      }
      open.delete(cur);
      for (const nb of this.nodes.get(cur)!.edges) {
        const t = (g.get(cur) ?? Infinity) + this.nodes.get(cur)!.p.distanceTo(this.nodes.get(nb)!.p);
        if (t < (g.get(nb) ?? Infinity)) {
          came.set(nb, cur);
          g.set(nb, t);
          f.set(nb, t + this.h(nb, goal));
          open.add(nb);
        }
      }
    }
    return [];
  }

  private h(a: string, b: string) {
    return this.nodes.get(a)!.p.distanceTo(this.nodes.get(b)!.p);
  }
}

export const nav = new NavGraph();

/**
 * Plan a smooth walking path (world XZ, y=0) from `from` to a goal point that
 * lies in a section's cross-aisle (or the foyer).
 */
export function planPath(from: THREE.Vector3, goal: THREE.Vector3, section: SectionId | null): THREE.Vector3[] {
  if (section) nav.ensure(section);
  const startNode = nav.nearest(new THREE.Vector2(from.x, from.z));
  const goal2 = new THREE.Vector2(goal.x, goal.z);
  const goalNode = section
    ? nav.nearest(goal2, (n) => n.id.startsWith(`s${section}b`) || n.id === `s${section}e`)
    : nav.nearest(goal2);
  const ids = nav.astar(startNode.id, goalNode.id);
  const pts = [from.clone().setY(0)];
  for (const id of ids) {
    const p = nav.nodes.get(id)!.p;
    pts.push(new THREE.Vector3(p.x, 0, p.y));
  }
  // drop the last bay node if the goal is "before" it along the aisle (avoid overshoot)
  if (section && pts.length > 2) {
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const side = sectionSide(section);
    if ((last.x - goal.x) * side > 0 && (prev.x - goal.x) * side < 0) pts.pop();
  }
  pts.push(goal.clone().setY(0));
  // remove near-duplicates and collapse the start if it's already past the first node
  const out: THREE.Vector3[] = [];
  for (const p of pts) if (!out.length || out[out.length - 1].distanceTo(p) > 0.35) out.push(p);
  if (out.length > 2 && out[0].distanceTo(out[2]) < out[1].distanceTo(out[2])) out.splice(1, 1);
  return out;
}

/** Arc-length parameterised smooth path for walking. */
export class WalkPath {
  readonly curve: THREE.CurvePath<THREE.Vector3>;
  readonly length: number;
  constructor(points: THREE.Vector3[]) {
    this.curve = new THREE.CurvePath<THREE.Vector3>();
    if (points.length < 2) points = [points[0], points[0].clone().add(new THREE.Vector3(0, 0, 0.01))];
    // rounded corners: straight segments joined by quadratic beziers
    const r = 0.9;
    let cursor = points[0].clone();
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      const next = points[i + 1];
      if (!next) {
        this.curve.add(new THREE.LineCurve3(cursor, p.clone()));
        break;
      }
      const inDir = p.clone().sub(cursor);
      const outDir = next.clone().sub(p);
      const rr = Math.min(r, inDir.length() / 2, outDir.length() / 2);
      const a = p.clone().sub(inDir.normalize().multiplyScalar(rr));
      const b = p.clone().add(outDir.normalize().multiplyScalar(rr));
      if (a.distanceTo(cursor) > 1e-3) this.curve.add(new THREE.LineCurve3(cursor, a));
      this.curve.add(new THREE.QuadraticBezierCurve3(a, p.clone(), b));
      cursor = b;
    }
    this.length = this.curve.getLength();
  }
  at(dist: number, target = new THREE.Vector3()) {
    const t = THREE.MathUtils.clamp(dist / Math.max(this.length, 1e-6), 0, 1);
    return target.copy(this.curve.getPointAt(t));
  }
  tangent(dist: number, target = new THREE.Vector3()) {
    const t = THREE.MathUtils.clamp(dist / Math.max(this.length, 1e-6), 0, 0.9999);
    return target.copy(this.curve.getTangentAt(t));
  }
}
