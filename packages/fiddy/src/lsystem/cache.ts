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
const derived = memo<Module[][] | Error>(16, (key) => {
  const [text, n, cap] = key.split(SEP);
  try {
    return derivations(grammarOf(text!), Number(n), Number(cap));
  } catch (e) {
    return e as Error;
  }
});

/** Every generation from the axiom to `n`, remembered; throws what deriving threw. */
export function generationsOf(text: string, n: number, cap: number): Module[][] {
  const d = derived([text, n, cap].join(SEP));
  if (d instanceof Error) throw d;
  return d;
}
