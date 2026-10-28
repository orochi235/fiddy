import { aimed, type Frame, forward, roll, yaw } from '../frame.js';
import type { Rng } from '../random.js';
import type { Bud, TreeNode } from '../skeleton.js';
import { add, length, scale, type Vec3 } from '../vec.js';
import { type Branching, distribute, gather } from './bh.js';
import { ShadowGrid } from './shadow.js';

export interface LightOptions {
  stage: string;
  cycles: number;
  /** Borchert–Honda's λ: the main axis's weight against a lateral's. */
  lambda: number;
  /** Resource a tree draws per unit of light at its base. */
  vigor: number;
  /** Most metamers one bud grows in a cycle. */
  burst: number;
  shadow: number;
  depth: number;
  /** Direction weights against the bud's heading, which counts 1. */
  light: number;
  up: number;
  gravity: number;
  wander: number;
  /** Radians. */
  angle: number;
  divergence: number;
  length: number;
  /** Mean bud exposure below which a lateral branch is shed; 0 sheds nothing. */
  shed: number;
  /** Every node's radius as it forms; the pipe model thickens them as they age. */
  width: number;
  cap: number;
}

interface Metamer {
  /** A local index, or −1 − tree for the node of the incoming bud the tree grew from. */
  parent: number;
  pos: Vec3;
  order: number;
  born: number;
  dead: boolean;
}

interface SimBud {
  tree: number;
  /** The metamer it sits on, or −1 while still on the incoming bud's node. */
  at: number;
  frame: Frame;
  order: number;
  /** Leads an axis: an incoming bud, or a lateral that has grown. */
  tip: boolean;
  dead: boolean;
  v: number;
}

const UP: Vec3 = [0, 1, 0];

function randomUnit(rng: Rng): Vec3 {
  const z = 2 * rng() - 1;
  const t = 2 * Math.PI * rng();
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(t), z, r * Math.sin(t)];
}

/**
 * Grows trees from `incoming` buds for `o.cycles` cycles, competing for light through one shadow
 * grid (Palubicki et al. 2009). Appends finished nodes to `nodes`; returns buds at the live tips.
 */
export function growLight(incoming: readonly Bud[], nodes: TreeNode[], rng: Rng, o: LightOptions): Bud[] {
  const grid = new ShadowGrid(o.length, o.shadow, o.depth);
  const T = incoming.length;
  const mets: Metamer[] = [];
  const buds: SimBud[] = incoming.map((b, tree) => ({ tree, at: -1, frame: b.frame, order: b.order, tip: true, dead: false, v: 0 }));
  for (const b of buds) grid.cast(b.frame.pos);

  /** Element indices: the trees' roots, then metamers, then buds. */
  const budElement = (i: number) => T + mets.length + i;
  function branching() {
    const n = T + mets.length + buds.length;
    const children: number[][] = Array.from({ length: n }, () => []);
    const main = new Array<boolean>(n).fill(true);
    const order = (e: number) => (e < T ? incoming[e]!.order : mets[e - T]!.order);
    const link = (e: number, parent: number, ord: number) => {
      children[parent]!.push(e);
      main[e] = ord === order(parent);
    };
    mets.forEach((m, i) => !m.dead && link(T + i, m.parent >= 0 ? T + m.parent : -1 - m.parent, m.order));
    const q = new Float64Array(n);
    const count = new Float64Array(n);
    buds.forEach((b, i) => {
      if (b.dead) return;
      link(budElement(i), b.at >= 0 ? T + b.at : b.tree, b.order);
      q[budElement(i)] = grid.exposure(b.frame.pos);
      count[budElement(i)] = 1;
    });
    const tree: Branching = { children, main };
    for (let t = 0; t < T; t++) {
      gather(tree, t, q);
      gather(tree, t, count);
    }
    return { tree, q, count };
  }

  function kill(b: Branching, e: number) {
    if (e >= budElement(0)) {
      const bud = buds[e - budElement(0)]!;
      bud.dead = true;
      grid.cast(bud.frame.pos, -1);
    } else mets[e - T]!.dead = true;
    for (const c of b.children[e]!) kill(b, c);
  }

  function direction(f: Frame, lateral: boolean): Vec3 {
    let d = add(f.heading, scale(grid.lightward(f.pos), o.light));
    d = add(d, scale(UP, o.up - (lateral ? o.gravity : 0)));
    if (o.wander > 0) d = add(d, scale(randomUnit(rng), o.wander));
    const l = length(d);
    return l > 1e-9 ? scale(d, 1 / l) : f.heading;
  }

  for (let c = 1; c <= o.cycles && mets.length < o.cap; c++) {
    let { tree, q, count } = branching();
    if (o.shed > 0) {
      let shed = false;
      for (let e = T; e < T + mets.length; e++) {
        if (!mets[e - T]!.dead && !tree.main[e] && q[e]! < o.shed * count[e]!) {
          kill(tree, e);
          shed = true;
        }
      }
      if (shed) ({ tree, q, count } = branching());
    }
    const share = new Float64Array(q.length);
    for (let t = 0; t < T; t++) distribute(tree, t, o.vigor * q[t]!, q, o.lambda, share);
    buds.forEach((b, i) => (b.v = b.dead ? 0 : share[budElement(i)]!));

    const shadows: Vec3[] = [];
    const before = buds.length;
    for (let i = 0; i < before; i++) {
      const b = buds[i]!;
      const n = Math.min(o.burst, Math.floor(b.v + 1e-9));
      if (b.dead || n <= 0 || mets.length >= o.cap) continue;
      grid.cast(b.frame.pos, -1);
      const lateral = b.order > incoming[b.tree]!.order;
      let f = b.frame;
      for (let k = 0; k < n && mets.length < o.cap; k++) {
        f = forward(aimed(f.pos, direction(f, lateral), f.left), o.length);
        mets.push({ parent: b.at >= 0 ? b.at : -1 - b.tree, pos: f.pos, order: b.order, born: c - 1 + (k + 1) / n, dead: false });
        b.at = mets.length - 1;
        f = roll(f, o.divergence);
        buds.push({ tree: b.tree, at: b.at, frame: yaw(f, o.angle), order: b.order + 1, tip: false, dead: false, v: 0 });
        shadows.push(f.pos);
      }
      b.frame = f;
      b.tip = true;
      shadows.push(f.pos);
    }
    for (const p of shadows) grid.cast(p);
  }
  return finish(incoming, mets, buds, nodes, o);
}

/** Pushes the live metamers as nodes and returns the tip buds. */
function finish(incoming: readonly Bud[], mets: readonly Metamer[], buds: readonly SimBud[], nodes: TreeNode[], o: LightOptions): Bud[] {
  const M = mets.length;
  const id = new Int32Array(M).fill(-1);
  const nodeOf = (local: number, tree: number) => (local >= 0 ? id[local]! : incoming[tree]!.node);
  mets.forEach((m, i) => {
    if (m.dead) return;
    id[i] = nodes.length;
    const parent = m.parent >= 0 ? id[m.parent]! : incoming[-1 - m.parent]!.node;
    nodes.push({ id: id[i]!, parent, pos: m.pos, radius: o.width, order: m.order, stage: o.stage, born: m.born });
  });
  const tips = buds.filter((b) => b.tip && !b.dead);
  const most = tips.reduce((a, b) => Math.max(a, b.v), 0);
  return tips.map((b) => ({ node: nodeOf(b.at, b.tree), frame: b.frame, order: b.order, vigor: most > 0 ? b.v / most : 1 }));
}
