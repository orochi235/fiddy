import type { Skeleton } from '../skeleton.js';
import { add, cross, scale, type Vec3 } from '../vec.js';
import { type Mesh, MeshBuilder } from './types.js';

export interface LeafOptions {
  /** A leaf's length, base to tip, in world units. */
  size: number;
  /** Its widest point as a fraction of its length. */
  width?: number;
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
/** Stations along a leaf's midrib, base to tip, and its half-width at each as a share of `width`. */
const OUTLINE: readonly [number, number][] = [
  [0, 0],
  [0.2, 0.75],
  [0.45, 1],
  [0.7, 0.8],
  [1, 0],
];

/** A flat leaf at every open bud, along the bud's heading, each rolled by the golden angle from
 *  the last so neighbors fan out. One-sided: render it double-sided. */
export function leafMesh(s: Skeleton, o: LeafOptions): Mesh {
  const half = (o.width ?? 0.5) / 2;
  const b = new MeshBuilder();
  s.buds.forEach((bud, k) => {
    const { pos, heading, left, up } = bud.frame;
    const a = k * GOLDEN;
    const across = add(scale(left, Math.cos(a)), scale(up, Math.sin(a)));
    const normal = cross(heading, across);
    const at = (u: number, v: number): Vec3 => add(pos, add(scale(heading, u * o.size), scale(across, v * o.size)));
    let prev: [number, number] | null = null;
    for (const [u, w] of OUTLINE) {
      const l = b.vertex(at(u, w * half), normal);
      const r = w === 0 ? l : b.vertex(at(u, -w * half), normal);
      if (prev) {
        if (prev[0] !== prev[1]) b.triangle(prev[0], prev[1], r);
        if (l !== r) b.triangle(prev[0], r, l);
      }
      prev = [l, r];
    }
  });
  return b.build();
}
