import { type Grammar, type Module, ModuleCapError } from './types.js';

export const DEFAULT_MODULE_CAP = 200_000;

/** Every generation from the axiom (index 0) to `n`, each rewriting every module of the one
 *  before in parallel. Throws `ModuleCapError` once a generation would pass `cap` modules. */
export function derivations(grammar: Grammar, n: number, cap = DEFAULT_MODULE_CAP): Module[][] {
  const out: Module[][] = [grammar.axiom];
  for (let g = 1; g <= n; g++) {
    const prev = out[g - 1]!;
    const next: Module[] = [];
    for (const m of prev) {
      const rule = grammar.rules[m.symbol];
      if (!rule) {
        next.push(m);
      } else {
        const body = rule.succ[0]!.body;
        if (next.length + body.length > cap) throw new ModuleCapError(cap, g);
        for (const b of body) next.push(b);
      }
      if (next.length > cap) throw new ModuleCapError(cap, g);
    }
    out.push(next);
  }
  return out;
}

export const derive = (grammar: Grammar, n: number, cap?: number): Module[] => derivations(grammar, n, cap).at(-1)!;

export const moduleText = (ms: readonly Module[]): string => ms.map((m) => m.symbol).join('');
