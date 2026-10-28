import { describe, expect, it } from 'vitest';
import { animate } from './animate.js';
import type { Design, Stage } from './design.js';
import { grow } from './grow.js';
import { PRESETS } from './presets.js';
import type { Skeleton, TreeNode } from './skeleton.js';
import { distance } from './vec.js';

const windy = (params: Stage['params'] = {}, clock = 0.3): Design => {
  const d = PRESETS.find((p) => p.name === 'Fig. 1.24d, in wind')!.design();
  return { ...d, clock, stages: d.stages.map((s) => (s.kind === 'wind' ? { ...s, params } : s)) };
};
const still = (): Design => {
  const d = windy();
  return { ...d, stages: d.stages.filter((s) => s.kind !== 'wind') };
};
const segment = (s: Skeleton, n: TreeNode) => (n.parent === null ? 0 : distance(n.pos, s.nodes[n.parent]!.pos));

/** How far a segment turned in the picture plane beyond its parent's turn, per unit of its
 *  length: its own curvature. */
function curvature(rest: Skeleton, bent: Skeleton, n: TreeNode): number {
  const turn = (m: TreeNode) => {
    if (m.parent === null) return 0;
    const [a, b] = [rest, bent].map((s) => {
      const p = s.nodes[m.parent!]!.pos;
      const q = s.nodes[m.id]!.pos;
      return Math.atan2(q[1] - p[1], q[0] - p[0]);
    });
    return Math.atan2(Math.sin(b! - a!), Math.cos(b! - a!));
  };
  return Math.abs(turn(n) - turn(rest.nodes[n.parent!]!)) / segment(rest, n);
}

describe('wind', () => {
  it('leaves the skeleton as it was at zero strength', () => {
    expect(grow(windy({ strength: 0 }))).toEqual(grow(still()));
  });

  it('bends without stretching, and never moves the root', () => {
    const rest = grow(still());
    const bent = grow(windy({ strength: 40, turbulence: 1 }));
    expect(bent.nodes).not.toEqual(rest.nodes);
    expect(bent.nodes[0]).toEqual(rest.nodes[0]);
    rest.nodes.forEach((n, i) => expect(segment(bent, bent.nodes[i]!)).toBeCloseTo(segment(rest, n), 9));
  });

  it('moves every bud with its node, selector or not', () => {
    const d = windy({ strength: 30 });
    const bent = grow({ ...d, stages: d.stages.map((s) => (s.kind === 'wind' ? { ...s, input: { ...s.input, select: { minOrder: 99 } } } : s)) });
    expect(bent.buds.length).toBe(grow(still()).buds.length);
    for (const b of bent.buds) expect(distance(b.frame.pos, bent.nodes[b.node]!.pos)).toBe(0);
  });

  it('bends outer branches more than the trunk', () => {
    const rest = grow(still());
    const bent = grow(windy({ strength: 30, turbulence: 0, gustiness: 0 }, 0));
    const mean = (keep: (n: TreeNode) => boolean) => {
      const ns = rest.nodes.filter((n) => n.parent !== null && keep(n));
      return ns.reduce((sum, n) => sum + curvature(rest, bent, n), 0) / ns.length;
    };
    expect(mean((n) => n.order >= 3)).toBeGreaterThan(5 * mean((n) => n.order === 0));
  });

  it('poses the same at the same time, reached forward or back, and wraps seamlessly', () => {
    const d = windy();
    const forward = animate(d);
    const back = animate(d);
    expect(forward.moving).toBe(true);
    forward.at(1);
    const there = grow(forward.at(5.3).design);
    back.at(7);
    back.at(7.9);
    expect(grow(back.at(5.3).design)).toEqual(there);
    expect(grow(back.at(0).design)).toEqual(grow(animate(d).at(8).design));
    expect(grow(forward.at(2).design)).not.toEqual(there);
  });

  it('takes no growth time', () => {
    const spans = animate(windy()).spans;
    expect(spans.at(-1)).toMatchObject({ stage: 'wind' });
    expect(spans.at(-1)!.start).toBe(spans.at(-1)!.end);
  });
});
