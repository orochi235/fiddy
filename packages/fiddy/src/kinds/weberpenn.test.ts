import { describe, expect, it } from 'vitest';
import { type Design, restack, type Stage } from '../design.js';
import { type Frame, pitch, roll, UPRIGHT, yaw } from '../frame.js';
import { grow } from '../grow.js';
import { streamFor } from '../random.js';
import type { Bud, TreeNode } from '../skeleton.js';
import { add, dot, scale, sub } from '../vec.js';
import { paramsOf } from './index.js';
import { weberPenn } from './weberpenn.js';

const tree = (seed: number, params: Stage['params'] = {}): Design => ({
  seed,
  stages: restack([
    { id: 'seed', kind: 'seed', params: {}, input: { from: [] } },
    { id: 'tree', kind: 'weberpenn', params, input: { from: [] } },
  ]),
});

/** How many stems start at each order: a node whose parent is the bud or has a lower order. */
function stemsByOrder(nodes: readonly TreeNode[], stage: string): number[] {
  const counts: number[] = [];
  for (const n of nodes) {
    if (n.stage !== stage) continue;
    const parent = n.parent === null ? undefined : nodes[n.parent];
    if (parent && parent.stage === stage && parent.order === n.order) continue;
    counts[n.order] = (counts[n.order] ?? 0) + 1;
  }
  return counts;
}

describe('the Weber–Penn stage', () => {
  it('grows the same from the same seed, and differently from another', () => {
    expect(grow(tree(1))).toEqual(grow(tree(1)));
    expect(grow(tree(2)).nodes).not.toEqual(grow(tree(1)).nodes);
  });

  it('grows as many stems at each level as the params ask', () => {
    const s = grow(tree(1, { levels: 3, branches1: 5, branches2: 3, branches3: 2 }));
    expect(stemsByOrder(s.nodes, 'tree')).toEqual([1, 5, 15, 30]);
    expect(stemsByOrder(grow(tree(1, { levels: 1, branches1: 7 })).nodes, 'tree')).toEqual([1, 7]);
    expect(stemsByOrder(grow(tree(1, { levels: 0 })).nodes, 'tree')).toEqual([1]);
  });

  it('leaves one bud at the tip of every stem', () => {
    const s = grow(tree(1, { levels: 2, branches1: 4, branches2: 3 }));
    expect(s.buds.length).toBe(1 + 4 + 12);
    const parents = new Set(s.nodes.map((n) => n.parent));
    for (const b of s.buds) {
      expect(parents.has(b.node)).toBe(false);
      expect(b.frame.pos).toEqual(s.nodes[b.node]!.pos);
      expect(b.order).toBe(s.nodes[b.node]!.order);
    }
  });

  it('grows outward: a stem is born after the point it hangs from', () => {
    const all = grow(tree(1)).nodes;
    for (const n of all.filter((n) => n.stage === 'tree')) {
      const parent = all[n.parent!]!;
      if (parent.stage === 'tree') expect(n.born).toBeGreaterThan(parent.born);
    }
  });

  it('continues from a bud that is not upright, along its heading, at its order', () => {
    const frame: Frame = { ...roll(pitch(yaw(UPRIGHT, 0.7), 0.4), 1.1), pos: [3, 2, 1] };
    const bud: Bud = { node: 0, frame, order: 2, vigor: 1 };
    const nodes: TreeNode[] = [{ id: 0, parent: null, pos: frame.pos, radius: 1, order: 2, stage: 'x', born: 0 }];
    const stage: Stage = { id: 'wp', kind: 'weberpenn', params: { levels: 1, branches1: 3, curve: 0, length: 6, segments: 3 }, input: { from: [] } };
    const buds = weberPenn.apply({ stage, params: paramsOf(stage), buds: [bud], nodes, rng: streamFor(1, 'wp'), clock: 0 });

    const trunk = nodes.filter((n) => n.order === 2 && n.stage === 'wp');
    expect(trunk[0]!.parent).toBe(0);
    const tip = add(frame.pos, scale(frame.heading, 6));
    trunk.at(-1)!.pos.forEach((x, i) => expect(x).toBeCloseTo(tip[i]!));
    for (const n of trunk) {
      const along = sub(n.pos, frame.pos);
      expect(dot(along, frame.heading) ** 2).toBeCloseTo(dot(along, along));
    }
    expect(nodes.filter((n) => n.order === 3).length).toBeGreaterThan(0);
    expect(buds.map((b) => b.order).sort()).toEqual([2, 3, 3, 3]);
  });
});
