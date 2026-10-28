import type { Skeleton } from '../skeleton.js';
import { add, cross, dot, length, normalize, scale, sub, type Vec3 } from '../vec.js';
import { type Mesh, MeshBuilder } from './types.js';

export interface TubeOptions {
  /** Vertices around each ring. */
  sides?: number;
  /** What every node's radius is multiplied by. */
  radiusScale?: number;
  /** No ring is thinner than this, after scaling, so the finest twigs stay visible. */
  minRadius?: number;
}

interface Chain {
  points: Vec3[];
  radii: number[];
}

/** The skeleton as runs of nodes, each continuing through its thickest child; a node's other
 *  children start runs of their own from its position, at their own radius. */
function chains(s: Skeleton): Chain[] {
  const kids: number[][] = s.nodes.map(() => []);
  for (const n of s.nodes) if (n.parent !== null) kids[n.parent]!.push(n.id);
  const main = (id: number) => kids[id]!.reduce<number | null>((best, k) => (best === null || s.nodes[k]!.radius > s.nodes[best]!.radius ? k : best), null);

  const out: Chain[] = [];
  const starts: { from: Vec3; radius: number; first: number }[] = [];
  for (const n of s.nodes) {
    if (n.parent !== null) continue;
    for (const k of kids[n.id]!) starts.push({ from: n.pos, radius: k === main(n.id) ? n.radius : s.nodes[k]!.radius, first: k });
  }
  while (starts.length > 0) {
    const { from, radius, first } = starts.pop()!;
    const chain: Chain = { points: [from], radii: [radius] };
    for (let id: number | null = first; id !== null; ) {
      const n = s.nodes[id]!;
      if (length(sub(n.pos, chain.points.at(-1)!)) > 1e-9) {
        chain.points.push(n.pos);
        chain.radii.push(n.radius);
      }
      const next = main(id);
      for (const k of kids[id]!) if (k !== next) starts.push({ from: n.pos, radius: s.nodes[k]!.radius, first: k });
      id = next;
    }
    if (chain.points.length > 1) out.push(chain);
  }
  return out;
}

/** Any unit vector perpendicular to `t`. */
function perpendicular(t: Vec3): Vec3 {
  return normalize(cross(t, Math.abs(t[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
}

/** The branches as tubes: a ring of `sides` vertices at every node, carried along each run by
 *  parallel transport so the tubes do not twist. */
export function tubeMesh(s: Skeleton, o: TubeOptions = {}): Mesh {
  const sides = Math.max(3, Math.round(o.sides ?? 8));
  const minRadius = o.minRadius ?? 0;
  const radiusScale = o.radiusScale ?? 1;
  const b = new MeshBuilder();
  for (const { points, radii } of chains(s)) {
    const m = points.length - 1;
    const dirs = points.slice(1).map((p, i) => normalize(sub(p, points[i]!)));
    let normal: Vec3 | null = null;
    let prev = -1;
    for (let i = 0; i <= m; i++) {
      const inDir = dirs[Math.max(0, i - 1)]!;
      const outDir = dirs[Math.min(m - 1, i)]!;
      let t = normalize(add(inDir, outDir));
      if (length(t) < 1e-9) t = outDir;
      if (normal) {
        const projected = sub(normal, scale(t, dot(t, normal)));
        normal = length(projected) < 1e-6 ? perpendicular(t) : normalize(projected);
      } else {
        normal = perpendicular(t);
      }
      const binormal = cross(t, normal);
      const r = Math.max(minRadius, radii[i]! * radiusScale);
      const ring = b.positions.length / 3;
      for (let j = 0; j < sides; j++) {
        const a = (2 * Math.PI * j) / sides;
        const d = add(scale(normal, Math.cos(a)), scale(binormal, Math.sin(a)));
        b.vertex(add(points[i]!, scale(d, r)), d);
      }
      if (prev >= 0) {
        for (let j = 0; j < sides; j++) {
          const j1 = (j + 1) % sides;
          b.triangle(prev + j, prev + j1, ring + j);
          b.triangle(prev + j1, ring + j1, ring + j);
        }
      }
      prev = ring;
    }
  }
  return b.build();
}
