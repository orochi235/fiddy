import { normalize, type Vec3 } from '../vec.js';
import { Grid } from './grid.js';

/** Where a tree starts: an incoming bud's position and heading. */
export interface Root {
  pos: Vec3;
  heading: Vec3;
  order: number;
  /** Most steps it grows straight while no point is in reach of anything grown from it. */
  trunk: number;
}

export interface ColonizeOptions {
  /** Each point pulls on its nearest node within this distance. */
  influence: number;
  /** A point this close to any node is reached, and removed. */
  kill: number;
  step: number;
  iterations: number;
}

/** A node of the grown tree. The first `roots.length` stand for the roots themselves. */
export interface Grown {
  pos: Vec3;
  /** Index into the same array; -1 for a root. */
  parent: number;
  /** Which root it grew from. */
  root: number;
  order: number;
  /** The iteration that grew it: 0 for a root. */
  born: number;
  children: number;
}

export interface Colonized {
  nodes: Grown[];
  /** Per attraction point, whether it is still unreached. */
  alive: boolean[];
}

/**
 * Space colonization (Runions, Lane and Prusinkiewicz 2007): each iteration, every point pulls on
 * its nearest node within `influence`; each pulled node grows one `step` along the mean direction
 * to its points; points within `kill` of a node are removed. Stops when no points remain, nothing
 * grows, or after `iterations`.
 */
export function colonize(points: readonly Vec3[], roots: readonly Root[], o: ColonizeOptions): Colonized {
  const reach = Math.max(o.influence, o.kill);
  const grid = new Grid(reach);
  points.forEach((p, i) => grid.insert(i, p));
  const alive = points.map(() => true);
  let living = points.length;
  const nearest = new Int32Array(points.length).fill(-1);
  const nearestD2 = new Float64Array(points.length).fill(Infinity);
  const nodes: Grown[] = roots.map((r, i) => ({ pos: r.pos, parent: -1, root: i, order: r.order, born: 0, children: 0 }));
  const childrenOf = new Map<number, number[]>();
  const trunkPhase = roots.map(() => true);
  const trunkSteps = roots.map(() => 0);
  const lead = roots.map((_, i) => i);

  const notice = (n: number) => {
    const q = nodes[n]!.pos;
    grid.near(q, reach, (i) => {
      if (!alive[i]) return;
      const p = points[i]!;
      const d2 = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
      if (d2 < o.kill * o.kill) {
        alive[i] = false;
        living--;
      } else if (d2 < o.influence * o.influence && d2 < nearestD2[i]!) {
        nearest[i] = n;
        nearestD2[i] = d2;
      }
    });
  };

  const add = (parent: number, dir: Vec3, born: number): number | null => {
    const from = nodes[parent]!;
    const pos: Vec3 = [from.pos[0] + dir[0] * o.step, from.pos[1] + dir[1] * o.step, from.pos[2] + dir[2] * o.step];
    const siblings = childrenOf.get(parent) ?? [];
    const tooClose = (o.step * 0.01) ** 2;
    for (const c of siblings) {
      const s = nodes[c]!.pos;
      if ((s[0] - pos[0]) ** 2 + (s[1] - pos[1]) ** 2 + (s[2] - pos[2]) ** 2 < tooClose) return null;
    }
    const id = nodes.length;
    nodes.push({ pos, parent, root: from.root, order: from.order + (from.children > 0 ? 1 : 0), born, children: 0 });
    from.children++;
    siblings.push(id);
    childrenOf.set(parent, siblings);
    return id;
  };

  for (let r = 0; r < roots.length; r++) notice(r);
  for (let iter = 1; iter <= o.iterations && living > 0; iter++) {
    const pull = new Map<number, [number, number, number]>();
    for (let i = 0; i < points.length; i++) {
      const n = nearest[i]!;
      if (!alive[i] || n < 0) continue;
      const p = points[i]!;
      const q = nodes[n]!.pos;
      const d = Math.sqrt(nearestD2[i]!);
      const acc = pull.get(n) ?? [0, 0, 0];
      acc[0] += (p[0] - q[0]) / d;
      acc[1] += (p[1] - q[1]) / d;
      acc[2] += (p[2] - q[2]) / d;
      pull.set(n, acc);
    }
    const added: number[] = [];
    for (const n of [...pull.keys()].sort((a, b) => a - b)) {
      trunkPhase[nodes[n]!.root] = false;
      const acc = pull.get(n)!;
      if (Math.hypot(...acc) < 1e-9) continue;
      const id = add(n, normalize(acc), iter);
      if (id !== null) added.push(id);
    }
    for (let r = 0; r < roots.length; r++) {
      if (!trunkPhase[r] || trunkSteps[r]! >= roots[r]!.trunk) continue;
      const id = add(lead[r]!, normalize(roots[r]!.heading), iter);
      if (id === null) continue;
      lead[r] = id;
      trunkSteps[r]!++;
      added.push(id);
    }
    if (added.length === 0) break;
    for (const id of added) notice(id);
  }
  return { nodes, alive };
}

/** Radii by the pipe model: a tip gets `tip`, and a node's radius raised to `exponent` is the sum
 *  of its children's. Children must come after their parents. */
export function pipeRadii(nodes: readonly Grown[], tip: number, exponent: number): number[] {
  const sum = new Float64Array(nodes.length);
  const radii = new Array<number>(nodes.length);
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i]!;
    radii[i] = n.children === 0 ? tip : sum[i]! ** (1 / exponent);
    if (n.parent >= 0) sum[n.parent] += radii[i]! ** exponent;
  }
  return radii;
}
