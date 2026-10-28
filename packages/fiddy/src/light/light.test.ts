import { describe, expect, it } from 'vitest';
import { type Design, restack, type Stage } from '../design.js';
import { grow } from '../grow.js';
import { bhSplit, distribute, gather } from './bh.js';
import { ShadowGrid } from './shadow.js';

const stage = (id: string, kind: string, params: Stage['params'] = {}): Stage => ({ id, kind, params, input: { from: [] } });
const tree = (seed: number, params: Stage['params'] = {}): Design => ({ seed, stages: restack([stage('seed', 'seed'), stage('tree', 'light', params)]) });
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

describe('bhSplit', () => {
  it('hands out exactly the resource it is given', () => {
    expect(sum(bhSplit(7, [0.3, 0.9, 0.5], [true, false, false], 0.6))).toBeCloseTo(7, 12);
  });

  it('favors the main axis as λ rises, and splits by light alone at one half', () => {
    expect(bhSplit(2, [1, 1], [true, false], 0.5)).toEqual([1, 1]);
    const [main, lateral] = bhSplit(2, [1, 1], [true, false], 0.7);
    expect(main).toBeGreaterThan(lateral!);
    expect(bhSplit(2, [1, 1], [true, false], 0.9)[0]).toBeGreaterThan(main!);
  });

  it('distributes over a tree so the tips together get the base resource', () => {
    // 0 → 1 (main) and 2 (lateral); 1 → 3, 4; leaves 2, 3, 4.
    const b = { children: [[1, 2], [3, 4], [], [], []], main: [true, true, false, true, false] };
    const q = new Float64Array([0, 0, 0.5, 1, 0.25]);
    expect(gather(b, 0, q)).toBeCloseTo(1.75, 12);
    const out = new Float64Array(5);
    distribute(b, 0, 10, q, 0.6, out);
    expect(out[2]! + out[3]! + out[4]!).toBeCloseTo(10, 12);
  });
});

describe('ShadowGrid', () => {
  it('shades the voxels below a bud, and a shaded bud gets less light and less resource', () => {
    const g = new ShadowGrid(1, 0.3, 4);
    g.cast([0.5, 5.5, 0.5]);
    const open: [number, number, number] = [6.5, 3.5, 0.5];
    const shaded: [number, number, number] = [0.5, 3.5, 0.5];
    g.cast(open);
    g.cast(shaded);
    expect(g.exposure(open)).toBe(1);
    expect(g.exposure(shaded)).toBeLessThan(g.exposure(open));
    const [toShaded, toOpen] = bhSplit(1, [g.exposure(shaded), g.exposure(open)], [false, false], 0.5);
    expect(toShaded).toBeLessThan(toOpen!);
  });

  it('points a bud at the edge of a shadow out of it, and takes a shadow away again', () => {
    const g = new ShadowGrid(1, 0.3, 4);
    g.cast([0.5, 5.5, 0.5]);
    expect(g.lightward([2.5, 3.5, 0.5])[0]).toBeGreaterThan(0);
    g.cast([0.5, 5.5, 0.5], -1);
    expect(g.shade([0.5, 3.5, 0.5])).toBeCloseTo(0, 12);
  });
});

describe('a light-competition stage', () => {
  const grown = (d: Design) => grow(d).nodes.filter((n) => n.stage === 'tree');
  const one = grow(tree(1));

  it('grows the same from the same seed, and differently from another', () => {
    expect(grown(tree(1))).toEqual(one.nodes.filter((n) => n.stage === 'tree'));
    expect(grown(tree(2))).not.toEqual(grown(tree(1)));
  });

  it('builds a well-formed tree: parents first, born outward, thicker toward the base', () => {
    const s = one;
    const nodes = s.nodes.filter((n) => n.stage === 'tree');
    expect(nodes.length).toBeGreaterThan(100);
    nodes.forEach((n, i) => {
      expect(n.id).toBe(i + 1);
      const p = s.nodes[n.parent!]!;
      expect(p.id).toBeLessThan(n.id);
      if (p.stage === 'tree') {
        expect(n.born).toBeGreaterThan(p.born);
        expect(p.radius).toBeGreaterThanOrEqual(n.radius - 1e-12);
        expect(n.order - p.order).toBeGreaterThanOrEqual(0);
      }
    });
  });

  it('leaves one bud at every live tip and nowhere else', () => {
    const s = one;
    const parents = new Set(s.nodes.map((n) => n.parent));
    const tips = s.nodes.filter((n) => n.stage === 'tree' && !parents.has(n.id)).map((n) => n.id);
    expect(s.buds.map((b) => b.node).sort((a, b) => a - b)).toEqual(tips);
    expect(Math.max(...s.buds.map((b) => b.vigor))).toBe(1);
  });

  it('sheds shaded branches when asked, and leaves no bud on them', () => {
    const shed = grow(tree(1, { shed: 0.5 }));
    expect(shed.nodes.length).toBeLessThan(one.nodes.length);
    const ids = new Set(shed.nodes.map((n) => n.id));
    expect(shed.buds.every((b) => ids.has(b.node))).toBe(true);
  });

  it('grows one tree per incoming bud, side by side', () => {
    const d: Design = { seed: 1, stages: restack([stage('a', 'seed', { x: -5 }), stage('b', 'seed', { x: 5 }), stage('tree', 'light')]) };
    const nodes = grow(d).nodes.filter((n) => n.stage === 'tree');
    const roots = new Set(nodes.filter((n) => n.parent! < 2).map((n) => n.parent));
    expect(roots).toEqual(new Set([0, 1]));
  });
});
