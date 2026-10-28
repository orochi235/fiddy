import { describe, expect, it } from 'vitest';
import { type Design, restack, type Stage } from './design.js';
import { grow, growSteps } from './grow.js';
import { pose } from './pose.js';
import type { Skeleton } from './skeleton.js';
import { spansOf } from './spans.js';
import { distance } from './vec.js';

const stage = (id: string, kind: string, params: Stage['params'] = {}): Stage => ({ id, kind, params, input: { from: [] } });
const design = (...stages: Stage[]): Design => ({ seed: 1, time: { grow: 2 }, stages: restack(stages) });

const plant = (params: Stage['params'] = {}) =>
  design(stage('seed', 'seed'), stage('plant', 'lsystem', { grammar: 'ω: F\np1: F → F[+F]F[-F]F', n: 3, ...params }));
const crown = (params: Stage['params'] = {}) => design(stage('seed', 'seed'), stage('crown', 'colonize', { points: 400, iterations: 200, ...params }));

const raw = (d: Design): Skeleton => {
  const last = growSteps(d).at(-1)!;
  if (!('raw' in last)) throw new Error('no skeleton');
  return last.raw;
};
const end = (d: Design) => spansOf(d).at(-1)!.end;
const lengthOf = (s: Skeleton, i: number) => {
  const n = s.nodes[i]!;
  return n.parent === null ? 0 : distance(n.pos, s.nodes[n.parent]!.pos);
};

describe('pose', () => {
  it('with no elongation and drawn girth, finishes as the tree was grown', () => {
    const d = plant({ elongate: 0 });
    expect(grow(d)).toEqual(raw(d));
  });

  it('leaves the youngest internodes short at the end of growth, and the oldest whole', () => {
    const d = plant({ elongate: 0.3 });
    const full = raw(d);
    const done = grow(d);
    expect(done.nodes.length).toBe(full.nodes.length);
    expect(lengthOf(done, 1)).toBeCloseTo(lengthOf(full, 1), 9);
    const last = full.nodes.reduce((a, n) => (n.born > a.born ? n : a));
    expect(lengthOf(done, last.id)).toBeLessThan(0.5 * lengthOf(full, last.id));
  });

  it('carries each node along its parent, its internode keeping its direction', () => {
    const d = plant({ elongate: 0.3 });
    const full = raw(d);
    const mid = pose(full, d, end(d) * 0.7);
    for (const n of mid.nodes) {
      if (n.parent === null) continue;
      const p = mid.nodes[n.parent]!;
      const was = full.nodes.find((m) => m.stage === n.stage && m.module === n.module && m.born === n.born)!;
      const from = full.nodes[was.parent!]!;
      const k = distance(n.pos, p.pos) / distance(was.pos, from.pos);
      expect(k).toBeGreaterThan(0);
      expect(k).toBeLessThanOrEqual(1 + 1e-9);
      for (let a = 0; a < 3; a++) expect(n.pos[a]! - p.pos[a]!).toBeCloseTo((was.pos[a]! - from.pos[a]!) * k, 9);
    }
  });

  it('reveals more of the tree as time goes on, and only the roots before growth starts', () => {
    const d = plant();
    const full = raw(d);
    expect(pose(full, d, 0).nodes.map((n) => n.stage)).toEqual(['seed']);
    let before = 0;
    for (const t of [0.2, 0.6, 1, 1.4, 2]) {
      const count = pose(full, d, t).nodes.length;
      expect(count).toBeGreaterThanOrEqual(before);
      before = count;
    }
    expect(pose(full, d, 99)).toEqual(pose(full, d, end(d)));
  });

  it('thickens a pipe-model trunk as its crown fills in', () => {
    const d = crown();
    const full = raw(d);
    const base = (t: number) => pose(full, d, t).nodes[1]?.radius ?? 0;
    expect(base(0.5)).toBeLessThan(base(1));
    expect(base(1)).toBeLessThan(base(2));
    const done = grow(d);
    const kids = new Map<number, number[]>();
    for (const n of done.nodes) if (n.parent !== null) kids.set(n.parent, [...(kids.get(n.parent) ?? []), n.id]);
    for (const n of done.nodes.slice(1)) {
      const sum = (kids.get(n.id) ?? []).reduce((a, c) => a + done.nodes[c]!.radius ** 2, 0);
      expect(n.radius).toBeCloseTo(Math.max(0.05, Math.sqrt(sum)), 9);
    }
  });

  it('thickens an L-system by the pipe model only when its girth asks', () => {
    const drawn = grow(plant());
    const piped = grow(plant({ girth: 'pipe', width: 0.1 }));
    expect(new Set(drawn.nodes.slice(1).map((n) => n.radius))).toEqual(new Set([1]));
    expect(piped.nodes[1]!.radius).toBeGreaterThan(4 * 0.1);
  });

  it('paces by module order when asked', () => {
    const d = design(stage('seed', 'seed'), stage('plant', 'lsystem', { grammar: 'ω: F[+FFFF]F', n: 0, elongate: 0 }));
    const full = raw(d);
    // By born, the axis's second F (module 8) forms with the branch's first; by module, last.
    const axis = (pace: 'born' | 'module') => {
      const s = pose(full, d, 1.3, pace);
      return lengthOf(s, s.nodes.findIndex((n) => n.module === 8));
    };
    expect(axis('born')).toBeCloseTo(1, 9);
    expect(axis('module')).toBeLessThan(0.9);
  });

  it('grows polygons with their internode and moves buds with their node', () => {
    const d = design(stage('seed', 'seed'), stage('plant', 'lsystem', { grammar: 'ω: FF{.+F.-F.-F.}', n: 0, elongate: 1 }));
    const full = raw(d);
    const done = grow(d);
    const tip = done.nodes.at(-1)!;
    expect(done.buds[0]!.frame.pos).toEqual(tip.pos);
    const [a] = full.polygons;
    const [b] = done.polygons;
    expect(distance(b!.points[0]!, b!.points[1]!)).toBeLessThan(distance(a!.points[0]!, a!.points[1]!));
  });
});
