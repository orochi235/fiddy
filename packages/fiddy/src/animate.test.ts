import { describe, expect, it } from 'vitest';
import { animate } from './animate.js';
import { type Design, restack } from './design.js';

const design = (): Design => ({
  seed: 1,
  time: { grow: 2, loop: 10 },
  stages: restack([
    { id: 'seed', kind: 'seed', params: {}, input: { from: [] } },
    { id: 'a', kind: 'lsystem', params: { delta: 20 }, motion: { delta: { kind: 'wave', shape: 'sine', cycles: 1, depth: 5, phase: 0 } }, input: { from: [] } },
    { id: 'b', kind: 'lsystem', params: {}, input: { from: [] } },
  ]),
});

describe('animate', () => {
  it('grows stages in turn, instant kinds taking no time, and holds the finished tree', () => {
    const a = animate(design());
    expect(a.spans).toEqual([
      { stage: 'seed', start: 0, end: 0 },
      { stage: 'a', start: 0, end: 2 },
      { stage: 'b', start: 2, end: 4 },
    ]);
    expect(a.at(0).grown).toEqual({ seed: 1, a: 0, b: 0 });
    expect(a.at(1).grown.a).toBeCloseTo(0.5, 6);
    expect(a.at(3).grown).toMatchObject({ a: 1 });
    expect(a.at(3).grown.b).toBeCloseTo(0.5, 6);
    expect(a.at(9).grown).toEqual({ seed: 1, a: 1, b: 1 });
  });

  it('swings a wave around the set value', () => {
    const a = animate(design());
    expect(a.moving).toBe(true);
    expect(a.at(2.5).design.stages[1]!.params.delta).toBeCloseTo(25, 6);
    expect(a.at(7.5).design.stages[1]!.params.delta).toBeCloseTo(15, 6);
    expect(a.at(7.5).design.stages[1]!.motion).toBeUndefined();
  });

  it('gives the same moment for the same time, reached forward or back', () => {
    const forward = animate(design());
    const back = animate(design());
    forward.at(1);
    const there = forward.at(6.3);
    back.at(8);
    back.at(9.9);
    expect(back.at(6.3)).toEqual(there);
    expect(back.at(16.3)).toEqual(there);
  });
});
