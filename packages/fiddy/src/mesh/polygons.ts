import type { Skeleton } from '../skeleton.js';
import { normalize, type Vec3 } from '../vec.js';
import { type Mesh, MeshBuilder } from './types.js';

/** Newell's normal: sound for a polygon that is not quite planar, as a turtle's often is. */
function normalOf(points: readonly Vec3[]): Vec3 {
  let x = 0, y = 0, z = 0;
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length]!;
    x += (a[1] - b[1]) * (a[2] + b[2]);
    y += (a[2] - b[2]) * (a[0] + b[0]);
    z += (a[0] - b[0]) * (a[1] + b[1]);
  });
  return normalize([x, y, z]);
}

/** The skeleton's polygons, flat-shaded and fanned from each one's first corner, which is right
 *  for the convex and star-shaped leaves L-systems draw. One-sided: render it double-sided. */
export function polygonMesh(s: Skeleton): Mesh {
  const b = new MeshBuilder();
  for (const g of s.polygons) {
    const n = normalOf(g.points);
    const ids = g.points.map((p) => b.vertex(p, n));
    for (let k = 1; k + 1 < ids.length; k++) b.triangle(ids[0]!, ids[k]!, ids[k + 1]!);
  }
  return b.build();
}
