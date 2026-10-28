import { hashString } from './random.js';
import type { Bud, TreeNode } from './skeleton.js';
import { add, cross, distance, rotate, sub, type Vec3 } from './vec.js';

export interface Wind {
  /** Degrees the most pliant tip leans at the top of a gust. */
  strength: number;
  /** Degrees in the ground plane it blows toward: 0 is +x, 90 is +z. */
  direction: number;
  /** 0–1: how far the wind drops between gusts. */
  gustiness: number;
  /** Whole gusts per loop. */
  gusts: number;
  /** Whole sway cycles per loop. */
  sway: number;
  /** How steeply thinness adds bend: 2 ignores girth, 4 is a beam's. */
  flex: number;
  /** 0–1: a flutter at three times the sway, out of step from branch to branch. */
  turbulence: number;
}

const TAU = 2 * Math.PI;
const RAD = Math.PI / 180;
const UP: Vec3 = [0, 1, 0];
const unit = (h: number) => h / 2 ** 32;

/** How far each segment bends at full wind, scaled so the most pliant root-to-tip chain sums
 *  to 1. A segment bends with its length times the length it carries (`load`), over its girth
 *  to the `flex`; girth is radius times √load, the pipe model, so a skeleton drawn at one
 *  radius still stiffens toward the root. */
function pliancy(nodes: readonly TreeNode[], flex: number): Float64Array {
  const n = nodes.length;
  const len = new Float64Array(n);
  const load = new Float64Array(n);
  let rMax = 0;
  for (let i = 0; i < n; i++) {
    const node = nodes[i]!;
    if (node.parent !== null) len[i] = distance(node.pos, nodes[node.parent]!.pos);
    rMax = Math.max(rMax, node.radius);
  }
  for (let i = n - 1; i >= 0; i--) {
    load[i]! += len[i]!;
    const p = nodes[i]!.parent;
    if (p !== null) load[p]! += load[i]!;
  }
  const give = new Float64Array(n);
  const chain = new Float64Array(n);
  let most = 0;
  for (let i = 0; i < n; i++) {
    const p = nodes[i]!.parent;
    if (p === null || len[i] === 0) continue;
    const r = Math.max(nodes[i]!.radius / rMax, 1e-6);
    give[i] = len[i]! * load[i]! ** (1 - flex / 2) * r ** -flex;
    chain[i] = chain[p]! + give[i]!;
    most = Math.max(most, chain[i]!);
  }
  if (most > 0) for (let i = 0; i < n; i++) give[i]! /= most;
  return give;
}

/**
 * Bends the tree in the wind at `clock` (0–1 through the loop), putting a new object in `nodes`
 * for each node that moves, and returns `buds` moved with their nodes. Every segment turns about
 * one level axis across the wind, so a node's turn is its parent's plus its own; lengths hold,
 * and nodes without a parent stay put. `salt` sets each branch's phases. Node ids must be their
 * indices, parents before children, as `growSteps` builds them.
 */
export function blow(nodes: TreeNode[], buds: readonly Bud[], w: Wind, clock: number, salt: number): Bud[] {
  if (w.strength === 0 || nodes.length === 0) return [...buds];
  const give = pliancy(nodes, w.flex);
  const a = w.direction * RAD;
  const axis = cross(UP, [Math.cos(a), 0, Math.sin(a)]);
  const gust = 1 - w.gustiness * 0.5 * (1 - Math.cos(TAU * (w.gusts * clock + unit(salt))));
  const peak = w.strength * RAD * gust;

  const n = nodes.length;
  const rest = nodes.slice();
  const branch = new Int32Array(n);
  const push = new Float64Array(n);
  const turn = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const node = rest[i]!;
    const p = node.parent;
    if (p === null || rest[p]!.order !== node.order) {
      // A branch's first node draws its phases; the rest of the branch shares them.
      branch[i] = i;
      const sway = unit(hashString(String(i), salt));
      const flutter = unit(hashString(String(i), salt ^ 0x9e3779b9));
      push[i] = 0.5 + 0.5 * Math.sin(TAU * (w.sway * clock + sway)) + 0.5 * w.turbulence * Math.sin(TAU * (3 * w.sway * clock + flutter));
    } else branch[i] = branch[p]!;
    if (p === null) continue;
    turn[i] = turn[p]! + peak * give[i]! * push[branch[i]!]!;
    nodes[i] = { ...node, pos: add(nodes[p]!.pos, rotate(sub(node.pos, rest[p]!.pos), axis, turn[i]!)) };
  }
  return buds.map((b) => {
    const t = turn[b.node]!;
    const f = b.frame;
    return { ...b, frame: { pos: nodes[b.node]!.pos, heading: rotate(f.heading, axis, t), left: rotate(f.left, axis, t), up: rotate(f.up, axis, t) } };
  });
}
