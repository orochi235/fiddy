import { add, cross, length, normalize, scale, type Vec3 } from './vec.js';

/** A turtle's position and orientation: ABOP's heading H, left L and up U, with H × L = U. */
export interface Frame {
  pos: Vec3;
  heading: Vec3;
  left: Vec3;
  up: Vec3;
}

/** At the origin, heading up the screen (+y), with up toward the viewer (+z). */
export const UPRIGHT: Frame = { pos: [0, 0, 0], heading: [0, 1, 0], left: [-1, 0, 0], up: [0, 0, 1] };

/** `a` and `b` turned by `angle` within their plane, `a` toward `b`. */
function turn(a: Vec3, b: Vec3, angle: number): [Vec3, Vec3] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [add(scale(a, c), scale(b, s)), add(scale(a, -s), scale(b, c))];
}

/** ABOP's `+`: about U, heading toward left. Negative turns right (`-`). */
export function yaw(f: Frame, angle: number): Frame {
  const [heading, left] = turn(f.heading, f.left, angle);
  return { ...f, heading, left };
}

/** ABOP's `&`: about L, heading toward down. Negative pitches up (`^`). */
export function pitch(f: Frame, angle: number): Frame {
  const [heading, down] = turn(f.heading, scale(f.up, -1), angle);
  return { ...f, heading, up: scale(down, -1) };
}

/** ABOP's `\`: about H, left toward up. Negative rolls right (`/`). */
export function roll(f: Frame, angle: number): Frame {
  const [left, up] = turn(f.left, f.up, angle);
  return { ...f, left, up };
}

export const forward = (f: Frame, step: number): Frame => ({ ...f, pos: add(f.pos, scale(f.heading, step)) });

/** The frame with its axes made orthonormal again, against drift over long strings. */
export function tidy(f: Frame): Frame {
  const heading = normalize(f.heading);
  const up = normalize(cross(heading, f.left));
  return { pos: f.pos, heading, left: cross(up, heading), up };
}

/** A frame at `pos` heading along `heading`, its left as near `left` as the heading allows. */
export function aimed(pos: Vec3, heading: Vec3, left: Vec3): Frame {
  const h = normalize(heading);
  let l = left;
  if (length(cross(h, l)) < 1e-9) l = length(cross(h, [0, 0, 1])) < 1e-9 ? [-1, 0, 0] : cross([0, 0, 1], h);
  return tidy({ pos, heading: h, left: l, up: [0, 0, 1] });
}
