import { describe, expect, it } from 'vitest';
import { type Design, restack, sanitizeDesign, selectBuds, type Stage } from './design.js';
import { grow, growSteps } from './grow.js';
import { PRESETS } from './presets.js';
import { skeletonHash } from './skeleton.js';

const stage = (id: string, kind: string, params: Stage['params'] = {}, select?: Stage['input']['select']): Stage => ({
  id,
  kind,
  params,
  input: { from: [], ...(select ? { select } : {}) },
});

const design = (...stages: Stage[]): Design => ({ seed: 1, stages: restack(stages) });

describe('growSteps', () => {
  it('chains stages through their buds', () => {
    const steps = growSteps(design(stage('seed', 'seed'), stage('a', 'lsystem', { grammar: 'ω: F[+F]F', n: 0 })));
    const last = steps.at(-1)!;
    if (!('skeleton' in last)) throw new Error('no skeleton');
    expect(last.skeleton.nodes.map((n) => n.stage)).toEqual(['seed', 'a', 'a', 'a']);
    expect(last.skeleton.nodes[1]!.parent).toBe(0);
    expect(last.skeleton.buds.map((b) => b.node)).toEqual([2, 3]);
  });

  it('leaves earlier stages untouched when a later one is edited', () => {
    const base = design(stage('seed', 'seed'), stage('a', 'lsystem', { n: 3 }), stage('b', 'lsystem', { n: 1 }));
    const edited = { ...base, stages: base.stages.map((s) => (s.id === 'b' ? { ...s, params: { n: 2, delta: 40 } } : s)) };
    const upTo = (d: Design) => grow(d).nodes.filter((n) => n.stage !== 'b');
    expect(upTo(edited)).toEqual(upTo(base));
  });

  it('marks a stage that throws, and every stage after it unreached', () => {
    const steps = growSteps(design(stage('seed', 'seed'), stage('a', 'lsystem', { grammar: 'F → FF' }), stage('b', 'lsystem')));
    expect('error' in steps[1]!).toBe(true);
    expect(steps[2]).toEqual({ stage: 'b', unreached: true });
    expect(() => grow(design(stage('seed', 'seed'), stage('x', 'nope')))).toThrow('no stage kind');
  });

  it('passes the buds a selector leaves on, open', () => {
    const d = design(
      stage('seed', 'seed'),
      stage('a', 'lsystem', { grammar: 'ω: F[+F]F', n: 0 }),
      stage('b', 'lsystem', { grammar: 'ω: F', n: 0 }, { minOrder: 1 }),
    );
    const s = grow(d);
    expect(s.nodes.filter((n) => n.stage === 'b').map((n) => n.parent)).toEqual([2]);
    expect(s.buds.map((b) => b.node).sort()).toEqual([3, 4]);
  });
});

describe('a stochastic stage', () => {
  const wild = (seed: number, n = 3) =>
    ({ seed, stages: restack([stage('seed', 'seed'), stage('trunk', 'lsystem', { grammar: 'ω: F[+F][-F]', n: 0 }), stage('crown', 'lsystem', { grammar: 'ω: F\nF → F[+F]F\nF → F[-F]F\nF → F', n }, { minOrder: 1 })]) }) as Design;
  const crown = (d: Design) => grow(d).nodes.filter((n) => n.stage === 'crown');

  it('derives a string per bud, and tags each node with its bud', () => {
    const nodes = crown(wild(1));
    expect(new Set(nodes.map((n) => n.bud))).toEqual(new Set([0, 1]));
    const shape = (bud: number) => nodes.filter((n) => n.bud === bud).map((n) => n.module).join();
    expect(shape(0)).not.toBe(shape(1));
  });

  it('grows the same from the same seed, and differently from another', () => {
    expect(crown(wild(1))).toEqual(crown(wild(1)));
    expect(crown(wild(2))).not.toEqual(crown(wild(1)));
  });

  it('leaves the nodes of a deterministic stage untagged', () => {
    expect(grow(wild(1)).nodes.filter((n) => n.stage === 'trunk').every((n) => n.bud === undefined)).toBe(true);
  });
});

describe('selectBuds', () => {
  it('chooses by order and by height through the skeleton', () => {
    const s = grow(design(stage('seed', 'seed'), stage('a', 'lsystem', { grammar: 'ω: F[+F]F[-F]F', n: 0 })));
    expect(selectBuds(s, { minOrder: 1 }).chosen.length).toBe(2);
    expect(selectBuds(s, { minHeight: 0.9 }).chosen.map((b) => b.order)).toEqual([1, 0]);
    expect(selectBuds(s, { minHeight: 0.99 }).chosen.map((b) => b.order)).toEqual([0]);
  });
});

describe('sanitizeDesign', () => {
  it('keeps a usable design and rewires it as a stack', () => {
    const d = sanitizeDesign({ seed: 3, stages: [{ id: 'a', kind: 'seed', params: { x: 1, bad: {} } }, { id: 'b', kind: 'lsystem', params: {} }, 7] });
    expect(d?.stages.map((s) => [s.id, s.input.from])).toEqual([['a', []], ['b', ['a']]]);
    expect(d?.stages[0]!.params).toEqual({ x: 1 });
    expect(sanitizeDesign({ stages: [] })).toBeNull();
  });
});

describe('presets', () => {
  it.each(PRESETS.map((p) => [p.name, p] as const))('%s grows, and its skeleton is unchanged', (_name, preset) => {
    const d = preset.design();
    const skeleton = grow(d);
    expect(skeleton.nodes.length).toBeGreaterThan(10);
    expect(skeletonHash(skeleton)).toMatchSnapshot();
  });
});
