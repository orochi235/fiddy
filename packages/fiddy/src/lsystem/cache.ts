import { parseGrammar } from './parse.js';
import { derivations } from './rewrite.js';
import type { Grammar, Module } from './types.js';

/** Remembers the last few results of `fn` by key: grammars are re-derived on every frame an
 *  angle or step moves, and the string depends only on the text and `n`. */
function memo<T>(size: number, fn: (key: string) => T): (key: string) => T {
  const kept = new Map<string, T>();
  return (key) => {
    if (kept.has(key)) {
      const v = kept.get(key)!;
      kept.delete(key);
      kept.set(key, v);
      return v;
    }
    const v = fn(key);
    kept.set(key, v);
    if (kept.size > size) kept.delete(kept.keys().next().value!);
    return v;
  };
}

const parsed = memo<Grammar | Error>(32, (text) => {
  try {
    return parseGrammar(text);
  } catch (e) {
    return e as Error;
  }
});

/** `parseGrammar`, remembered; throws what it threw. */
export function grammarOf(text: string): Grammar {
  const g = parsed(text);
  if (g instanceof Error) throw g;
  return g;
}

const SEP = '\u0000';
// Room for one derivation per bud of a stochastic crown, so an animated angle does not re-derive.
const derived = memo<Module[][] | Error>(64, (key) => {
  const [text, n, cap, seed] = key.split(SEP);
  try {
    return derivations(grammarOf(text!), Number(n), Number(cap), Number(seed));
  } catch (e) {
    return e as Error;
  }
});

/** Every generation from the axiom to `n`, remembered; throws what deriving threw. `seed` only
 *  matters to a stochastic grammar. */
export function generationsOf(text: string, n: number, cap: number, seed = 0): Module[][] {
  const d = derived([text, n, cap, grammarOf(text).stochastic ? seed : 0].join(SEP));
  if (d instanceof Error) throw d;
  return d;
}
