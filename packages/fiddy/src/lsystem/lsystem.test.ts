import { describe, expect, it } from 'vitest';
import { UPRIGHT } from '../frame.js';
import type { TreeNode } from '../skeleton.js';
import { PRESETS } from '../presets.js';
import { parseGrammar, takeDefines } from './parse.js';
import { derivations, derive, moduleText } from './rewrite.js';
import { interpret, type TurtleOptions } from './turtle.js';
import { type Grammar, ModuleCapError, ParseError } from './types.js';

const FIG_1_24C = `n = 4   δ = 22.5°
ω: F
p1: F → FF-[-F+F+F]+[+F-F-F]`;

function refused(source: string): ParseError {
  try {
    parseGrammar(source);
  } catch (e) {
    if (e instanceof ParseError) return e;
    throw e;
  }
  throw new Error('parsed');
}

describe('parseGrammar', () => {
  it("reads ABOP's notation, defines included", () => {
    const g = parseGrammar(FIG_1_24C);
    expect(moduleText(g.axiom)).toBe('F');
    expect(moduleText(g.rules.F!.succ[0]!.body)).toBe('FF-[-F+F+F]+[+F-F-F]');
    expect(g.defines).toEqual({ n: 4, delta: 22.5 });
  });

  it('reads the ASCII stand-ins and comments', () => {
    const g = parseGrammar('w: X  # start\nX -> F[+X]F[-X]+X\nF->FF');
    expect(moduleText(g.rules.X!.succ[0]!.body)).toBe('F[+X]F[-X]+X');
    expect(Object.keys(g.rules)).toEqual(['X', 'F']);
  });

  it.each([
    ['ω: A(1)', 1, 5, 'piece 4'],
    ['ω: A\np1: A : t > 1 → F', 2, 7, 'piece 4'],
    ['ω: A\np1: B < A → F', 2, 7, 'piece 5'],
  ])('refuses later-piece syntax with its position: %j', (source, line, col, piece) => {
    const e = refused(source);
    expect([e.line, e.col]).toEqual([line, col]);
    expect(e.message).toContain(piece);
  });

  it('reads several rules for one symbol as weighted alternatives', () => {
    const g = parseGrammar('ω: F\np1: F (.33) → F[+F]F\np2: F (.33) -> F[-F]F\np3: F (.34) → F');
    expect(g.stochastic).toBe(true);
    expect(g.rules.F!.succ.map((a) => [a.prob, moduleText(a.body)])).toEqual([
      [0.33, 'F[+F]F'],
      [0.33, 'F[-F]F'],
      [0.34, 'F'],
    ]);
  });

  it('splits what written probabilities leave among the unwritten, evenly', () => {
    const g = parseGrammar('ω: F\nF (.5) → FF\nF → F[+F]\nF → F[-F]');
    expect(g.rules.F!.succ.map((a) => a.prob)).toEqual([0.5, 0.25, 0.25]);
    expect(parseGrammar('ω: F\nF → FF\nF → F').rules.F!.succ.map((a) => a.prob)).toEqual([0.5, 0.5]);
  });

  it('leaves a deterministic grammar without probabilities', () => {
    const g = parseGrammar(FIG_1_24C);
    expect(g.stochastic).toBe(false);
    expect(g.rules.F!.succ[0]!.prob).toBeUndefined();
  });

  it('refuses probabilities past 1', () => {
    expect(refused('ω: F\nF (.7) → FF\nF (.7) → F').message).toContain('more than 1');
    expect(refused('ω: F\nF (1.5) → FF').message).toContain('from 0 to 1');
  });

  it('takes defines out of a pasted grammar', () => {
    expect(takeDefines(FIG_1_24C)).toEqual({ source: 'ω: F\np1: F → FF-[-F+F+F]+[+F-F-F]', defines: { n: 4, delta: 22.5 } });
  });

  it('requires an axiom', () => {
    expect(refused('F → FF').message).toContain('no axiom');
  });
});

/** The module count at each generation, from symbol counts alone: an oracle that shares nothing
 *  with the rewriter but the grammar. */
function countsByRecurrence(g: Grammar, n: number): number[] {
  let counts = new Map<string, number>();
  for (const m of g.axiom) counts.set(m.symbol, (counts.get(m.symbol) ?? 0) + 1);
  const totals = [g.axiom.length];
  for (let i = 0; i < n; i++) {
    const next = new Map<string, number>();
    for (const [sym, c] of counts) {
      const body = g.rules[sym]?.succ[0]!.body ?? [{ symbol: sym }];
      for (const b of body) next.set(b.symbol, (next.get(b.symbol) ?? 0) + c);
    }
    counts = next;
    totals.push([...counts.values()].reduce((a, b) => a + b, 0));
  }
  return totals;
}

describe('derivations', () => {
  it('rewrites every module in parallel', () => {
    const g = parseGrammar(FIG_1_24C);
    expect(moduleText(derive(g, 1))).toBe('FF-[-F+F+F]+[+F-F-F]');
    expect(derivations(g, 4).map((d) => d.length)).toEqual(countsByRecurrence(g, 4));
  });

  const fixed = PRESETS.filter((p) => p.source && !parseGrammar(String(p.design().stages[1]!.params.grammar)).stochastic);
  it.each(fixed.map((p) => [p.name, p] as const))('%s derives the count its grammar implies', (_name, p) => {
    const params = p.design().stages[1]!.params;
    const g = parseGrammar(String(params.grammar));
    const n = params.n as number;
    expect(derive(g, n, 1e7).length).toBe(countsByRecurrence(g, n).at(-1));
  });

  it('stops at the module cap', () => {
    const g = parseGrammar(FIG_1_24C);
    expect(() => derive(g, 4, 1000)).toThrow(ModuleCapError);
  });
});

describe('stochastic derivations', () => {
  const g = parseGrammar('ω: F\nF (.5) → F[+F]F\nF (.3) → F[-F]F\nF (.2) → F');

  it('derives the same string from the same seed, and a different one from another', () => {
    expect(moduleText(derive(g, 4, undefined, 7))).toBe(moduleText(derive(g, 4, undefined, 7)));
    const strings = new Set([1, 2, 3, 4, 5].map((seed) => moduleText(derive(g, 4, undefined, seed))));
    expect(strings.size).toBeGreaterThan(1);
  });

  it('keeps the earlier generations when n is raised', () => {
    const short = derivations(g, 3, undefined, 11).map(moduleText);
    const long = derivations(g, 5, undefined, 11).map(moduleText);
    expect(long.slice(0, 4)).toEqual(short);
  });

  it('chooses each alternative about as often as its probability', () => {
    const one = parseGrammar('ω: A\nA (.6) → B\nA (.25) → C');
    const counts: Record<string, number> = {};
    for (let seed = 0; seed < 4000; seed++) {
      const s = moduleText(derive(one, 1, undefined, seed));
      counts[s] = (counts[s] ?? 0) + 1;
    }
    expect(counts.B! / 4000).toBeCloseTo(0.6, 1);
    expect(counts.C! / 4000).toBeCloseTo(0.25, 1);
    // What the written probabilities leave is the chance A stays A.
    expect(counts.A! / 4000).toBeCloseTo(0.15, 1);
  });
});

const OPTS: TurtleOptions = { delta: Math.PI / 2, step: 1, width: 1, thin: 0.5, stage: 's', cap: 1e6 };
const ROOT: TreeNode = { id: 0, parent: null, pos: [0, 0, 0], radius: 1, order: 0, stage: 'seed', born: 0 };
const BUD = { node: 0, frame: UPRIGHT, order: 0, vigor: 1 };

function walk(text: string) {
  const nodes: TreeNode[] = [ROOT];
  const buds = interpret(parseGrammar(`ω: ${text}`).axiom, BUD, nodes, OPTS);
  const at = (i: number) => nodes[i]!.pos.map((v) => Math.round(v * 1e9) / 1e9 + 0);
  return { nodes, buds, at };
}

describe('interpret', () => {
  it('draws F and turns left on +', () => {
    const { nodes, at } = walk('F+F');
    expect(nodes.map((n) => n.parent)).toEqual([null, 0, 1]);
    expect(at(1)).toEqual([0, 1, 0]);
    expect(at(2)).toEqual([-1, 1, 0]);
    expect(nodes[2]!.born).toBe(2);
    expect(nodes[2]!.module).toBe(2);
  });

  it('restores position, heading and order after a branch', () => {
    const { nodes, at, buds } = walk('F[+F]F');
    expect(nodes.map((n) => n.parent)).toEqual([null, 0, 1, 1]);
    expect(nodes[2]!.order).toBe(1);
    expect(at(3)).toEqual([0, 2, 0]);
    expect(buds.map((b) => b.node)).toEqual([2, 3]);
    expect(buds.map((b) => b.order)).toEqual([1, 0]);
  });

  it('starts a new line after f, and thins on !', () => {
    const { nodes, at } = walk('Ff!F');
    expect(nodes.map((n) => n.parent)).toEqual([null, 0, null, 2]);
    expect(at(3)).toEqual([0, 3, 0]);
    expect(nodes[3]!.radius).toBe(0.5);
  });
});
