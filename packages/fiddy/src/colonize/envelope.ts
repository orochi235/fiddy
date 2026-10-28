import type { Frame } from '../frame.js';
import type { Rng } from '../random.js';
import { add, scale, type Vec3 } from '../vec.js';

export const SHAPES = ['ellipsoid', 'cone', 'cylinder'] as const;
export type Shape = (typeof SHAPES)[number];

/** A crown volume: `width` across and `height` along the frame's heading, its base at the frame's
 *  position. A cone is widest at its base. */
export interface Envelope {
  shape: Shape;
  frame: Frame;
  width: number;
  height: number;
}

/** Whether the point at height `y` along the axis and `r` from it lies inside. */
function inside(shape: Shape, width: number, height: number, y: number, r: number): boolean {
  const w = width / 2;
  switch (shape) {
    case 'ellipsoid': {
      const h = height / 2;
      return (r / w) ** 2 + ((y - h) / h) ** 2 <= 1;
    }
    case 'cone':
      return r <= w * (1 - y / height);
    case 'cylinder':
      return r <= w;
  }
}

/** `count` points spread uniformly through the envelope, by rejection from its bounding box. */
export function scatter(e: Envelope, count: number, rng: Rng): Vec3[] {
  const out: Vec3[] = [];
  const w = e.width / 2;
  const { pos, heading, left, up } = e.frame;
  for (let tries = 0; out.length < count && tries < count * 20; tries++) {
    const x = (rng() * 2 - 1) * w;
    const y = rng() * e.height;
    const z = (rng() * 2 - 1) * w;
    if (!inside(e.shape, e.width, e.height, y, Math.hypot(x, z))) continue;
    out.push(add(add(add(pos, scale(left, x)), scale(heading, y)), scale(up, z)));
  }
  return out;
}
