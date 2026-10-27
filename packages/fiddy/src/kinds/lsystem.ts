import type { ParamValue } from '../design.js';
import { generationsOf, grammarOf } from '../lsystem/cache.js';
import { DEFAULT_MODULE_CAP } from '../lsystem/rewrite.js';
import { interpret } from '../lsystem/turtle.js';
import type { Rng } from '../random.js';
import type { Bud } from '../skeleton.js';
import type { StageKind } from './types.js';

const RAD = Math.PI / 180;

/** An L-system's params with defaults filled, as the stage and a UI's views both read them. */
export const lsystemParams = (p: Record<string, ParamValue>) => ({
  grammar: String(p.grammar),
  n: Math.max(0, Math.round(p.n as number)),
  delta: p.delta as number,
  step: p.step as number,
  width: p.width as number,
  thin: p.thin as number,
  cap: Math.round(p.cap as number),
});

/** The seed each of `count` buds derives its string from: for a stochastic grammar, one draw per
 *  bud from the stage's stream, in bud order; otherwise 0 for all, and they share one string. */
export function derivationSeeds(grammar: string, rng: Rng, count: number): number[] {
  if (!grammarOf(grammar).stochastic) return new Array<number>(count).fill(0);
  return Array.from({ length: count }, () => Math.floor(rng() * 2 ** 32));
}

/** A grammar rewritten `n` times, then drawn by a turtle from each selected bud. */
export const lsystem: StageKind = {
  kind: 'lsystem',
  title: 'L-system',
  params: [
    { key: 'grammar', label: 'Grammar', type: 'text', default: 'ω: F\np1: F → F[+F]F[-F]F' },
    { key: 'n', label: 'n', type: 'number', default: 4, min: 0, max: 12, step: 1 },
    { key: 'delta', label: 'δ', type: 'number', default: 25.7, min: 0, max: 180, step: 0.1, suffix: '°' },
    { key: 'step', label: 'Step', type: 'number', default: 1, min: 0.01, max: 10, step: 0.01 },
    { key: 'width', label: 'Width', type: 'number', default: 1, min: 0.01, max: 10, step: 0.01 },
    { key: 'thin', label: 'Thin (!)', type: 'number', default: 0.7, min: 0.05, max: 1, step: 0.01 },
    { key: 'cap', label: 'Module cap', type: 'number', default: DEFAULT_MODULE_CAP, min: 1000, max: 2_000_000, step: 1000 },
  ],
  apply({ stage, params, buds, nodes, rng }) {
    const p = lsystemParams(params);
    const stochastic = grammarOf(p.grammar).stochastic;
    const seeds = derivationSeeds(p.grammar, rng, buds.length);
    const out: Bud[] = [];
    const opts = { delta: p.delta * RAD, step: p.step, width: p.width, thin: p.thin, stage: stage.id, cap: p.cap };
    buds.forEach((bud, i) => {
      const modules = generationsOf(p.grammar, p.n, p.cap, seeds[i]).at(-1)!;
      out.push(...interpret(modules, bud, nodes, stochastic ? { ...opts, bud: i } : opts));
    });
    return out;
  },
};
