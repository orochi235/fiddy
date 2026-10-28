import { describe, expect, it } from 'vitest';
import { type Design, restack, type Stage } from '../design.js';
import { aimed } from '../frame.js';
import { grow } from '../grow.js';
import { mulberry32 } from '../random.js';
import { distance, dot, length, normalize, sub, type Vec3 } from '../vec.js';
import { colonize, pipeRadii } from './colonize.js';
import { scatter } from './envelope.js';

const stage = (id: string, kind: string, params: Stage['params'] = {}): Stage => ({ id, kind, params, input: { from: [] } });
const design = (seed: number, params: Stage['params'] = {}): Design => ({
  seed,
  stages: restack([stage('seed', 'seed'), stage('crown', 'colonize', params)]),
});
const crown = (d: Design) => grow(d).nodes.filter((n) => n.stage === 'crown');

const OPTS = { influence: 12, kill: 2, step: 1, iterations: 400 };
const envelope = { shape: 'ellipsoid' as const, frame: aimed([0, 15, 0], [0, 1, 0], [-1, 0, 0]), width: 40, height: 30 };
const run = () => {
  const points = scatter(envelope, 1500, mulberry32(7));
  const roots = [{ pos: [0, 0, 0] as Vec3, heading: [0, 1, 0] as Vec3, order: 0, trunk: 60 }];
  return { points, ...colonize(points, roots, OPTS) };
};

describe('colonize', () => {
  it('grows a trunk straight up until the crown is in reach, then grows only toward points', () => {
    const { points, nodes } = run();
    for (const n of nodes.slice(1)) {
      const parent = nodes[n.parent]!;
      const dir = sub(n.pos, parent.pos);
      expect(length(dir)).toBeCloseTo(1, 9);
      const pulled = points.some((p) => distance(p, parent.pos) < OPTS.influence && dot(dir, sub(p, parent.pos)) > 0);
      const trunk = n.pos[0] === 0 && n.pos[2] === 0 && n.pos[1] <= 15 - OPTS.influence + 1;
      expect(pulled || trunk).toBe(true);
    }
  });

  it('leaves no point within kill distance of any node', () => {
    const { points, nodes, alive } = run();
    expect(alive.filter(Boolean).length).toBeLessThan(points.length / 10);
    points.forEach((p, i) => {
      if (alive[i]) for (const n of nodes) expect(distance(p, n.pos)).toBeGreaterThanOrEqual(OPTS.kill);
    });
  });

  it('pipes radii so every branch is at least as thick as what it carries', () => {
    const { nodes } = run();
    const radii = pipeRadii(nodes, 0.05, 2);
    nodes.forEach((n, i) => {
      if (n.parent > 0) expect(radii[n.parent]!).toBeGreaterThanOrEqual(radii[i]! - 1e-12);
      if (n.children === 0) expect(radii[i]).toBe(0.05);
    });
    expect(radii[1]!).toBeGreaterThan(10 * 0.05);
  });
});

describe('the colonize stage', () => {
  it('grows the same from the same seed, and differently from another', () => {
    expect(crown(design(1))).toEqual(crown(design(1)));
    expect(crown(design(2))).not.toEqual(crown(design(1)));
  });

  it('appends nodes after the seed, hanging from it, with radii tapering from root to tip', () => {
    const nodes = grow(design(1)).nodes;
    expect(nodes.map((n) => n.id)).toEqual(nodes.map((_, i) => i));
    expect(nodes[1]!.parent).toBe(0);
    for (const n of nodes.slice(1)) expect(n.parent!).toBeLessThan(n.id);
    for (const n of nodes.slice(2)) expect(nodes[n.parent!]!.radius).toBeGreaterThanOrEqual(n.radius - 1e-12);
    expect(nodes[1]!.radius).toBeGreaterThan(10 * nodes.at(-1)!.radius);
    expect(Math.max(...nodes.map((n) => n.order))).toBeGreaterThan(3);
  });

  it('leaves a bud at every tip, heading along its last segment', () => {
    const { nodes, buds } = grow(design(1));
    const parents = new Set(nodes.map((n) => n.parent));
    const tips = nodes.filter((n) => n.stage === 'crown' && !parents.has(n.id)).map((n) => n.id);
    expect(buds.map((b) => b.node).sort((a, b) => a - b)).toEqual(tips);
    for (const b of buds) {
      const n = nodes[b.node]!;
      expect(dot(b.frame.heading, normalize(sub(n.pos, nodes[n.parent!]!.pos)))).toBeCloseTo(1, 9);
      expect(dot(b.frame.heading, b.frame.left)).toBeCloseTo(0, 9);
    }
  });

  it('builds every crown shape', () => {
    for (const shape of ['ellipsoid', 'cone', 'cylinder']) expect(crown(design(1, { shape, points: 400 })).length).toBeGreaterThan(30);
  });
});
