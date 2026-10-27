import { mulberry32, type Rng } from '../random.js';
import { type Grammar, type Module, ModuleCapError, type Rule } from './types.js';

export const DEFAULT_MODULE_CAP = 200_000;

/** The successor `rule` rewrites one module to, or null to leave the module as it is. */
function choose(rule: Rule, rng: Rng): readonly Module[] | null {
  if (rule.succ[0]!.prob === undefined) return rule.succ[0]!.body;
  let r = rng();
  for (const alt of rule.succ) {
    r -= alt.prob!;
    if (r < 0) return alt.body;
  }
  return null;
}

/** Every generation from the axiom (index 0) to `n`, each rewriting every module of the one
 *  before in parallel. A stochastic rule draws once per module it rewrites, in string order, from
 *  a stream fixed by `seed`, so raising `n` leaves the earlier generations as they were. Throws
 *  `ModuleCapError` once a generation would pass `cap` modules. */
export function derivations(grammar: Grammar, n: number, cap = DEFAULT_MODULE_CAP, seed = 0): Module[][] {
  const rng = mulberry32(seed);
  const out: Module[][] = [grammar.axiom];
  for (let g = 1; g <= n; g++) {
    const prev = out[g - 1]!;
    const next: Module[] = [];
    for (const m of prev) {
      const rule = grammar.rules[m.symbol];
      const body = rule ? choose(rule, rng) : null;
      if (!body) {
        next.push(m);
      } else {
        if (next.length + body.length > cap) throw new ModuleCapError(cap, g);
        for (const b of body) next.push(b);
      }
      if (next.length > cap) throw new ModuleCapError(cap, g);
    }
    out.push(next);
  }
  return out;
}

export const derive = (grammar: Grammar, n: number, cap?: number, seed?: number): Module[] => derivations(grammar, n, cap, seed).at(-1)!;

export const moduleText = (ms: readonly Module[]): string => ms.map((m) => m.symbol).join('');
