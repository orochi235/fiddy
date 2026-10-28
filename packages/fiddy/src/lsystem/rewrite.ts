import { mulberry32, type Rng } from '../random.js';
import { type Grammar, type Module, ModuleCapError, type ModuleTemplate, type Pattern, type Rule } from './types.js';

export const DEFAULT_MODULE_CAP = 200_000;

const arity = (m: Module) => m.params?.length ?? 0;
const fits = (m: Module, p: Pattern) => m.symbol === p.symbol && arity(m) === p.params.length;

/** For each bracket in `ms`, the index of its partner; -1 elsewhere or when unbalanced. */
function partners(ms: readonly Module[]): Int32Array {
  const out = new Int32Array(ms.length).fill(-1);
  const open: number[] = [];
  for (let i = 0; i < ms.length; i++) {
    if (ms[i]!.symbol === '[') open.push(i);
    else if (ms[i]!.symbol === ']') {
      const j = open.pop();
      if (j !== undefined) {
        out[i] = j;
        out[j] = i;
      }
    }
  }
  return out;
}

interface Neighbors {
  ms: readonly Module[];
  pair: Int32Array;
  ignore: ReadonlySet<string>;
}

/** The modules matching `pats` before `i`, in reading order: ABOP's left context, which steps
 *  over whole branches and out of the one `i` is in. */
function leftOf(n: Neighbors, i: number, pats: readonly Pattern[]): number[] | null {
  const got: number[] = [];
  let j = i - 1;
  for (let k = pats.length - 1; k >= 0; k--) {
    for (;;) {
      if (j < 0) return null;
      const s = n.ms[j]!.symbol;
      if (n.ignore.has(s) || s === '[') j--;
      else if (s === ']') j = n.pair[j]! < 0 ? -1 : n.pair[j]! - 1;
      else break;
    }
    if (!fits(n.ms[j]!, pats[k]!)) return null;
    got.unshift(j--);
  }
  return got;
}

/** The modules matching `pats` after `i`: a right context steps over branches it does not name,
 *  and a `]` in it skips to the end of the branch it is in. */
function rightOf(n: Neighbors, i: number, pats: readonly Pattern[]): number[] | null {
  const got: number[] = [];
  let j = i + 1;
  for (const p of pats) {
    if (p.symbol === ']') {
      let depth = 0;
      for (; j < n.ms.length; j++) {
        const s = n.ms[j]!.symbol;
        if (s === '[') depth++;
        else if (s === ']' && depth-- === 0) break;
      }
      if (j >= n.ms.length) return null;
      j++;
      continue;
    }
    for (;;) {
      if (j >= n.ms.length) return null;
      const s = n.ms[j]!.symbol;
      if (n.ignore.has(s)) j++;
      else if (s === '[' && p.symbol !== '[') j = n.pair[j]! < 0 ? n.ms.length : n.pair[j]! + 1;
      else break;
    }
    if (!fits(n.ms[j]!, p)) return null;
    got.push(j++);
  }
  return got;
}

/** The successor `rule` rewrites one module to, or null to leave the module as it is. */
function choose(rule: Rule, rng: Rng): readonly ModuleTemplate[] | null {
  if (rule.succ[0]!.prob === undefined) return rule.succ[0]!.body;
  let r = rng();
  for (const alt of rule.succ) {
    r -= alt.prob!;
    if (r < 0) return alt.body;
  }
  return null;
}

const env = (ms: readonly Module[], at: readonly number[]): number[] => at.flatMap((k) => ms[k]!.params ?? []);

/** What the module at `i` rewrites to: the first rule whose predecessor, contexts, and condition
 *  hold, with its formals bound; null when none does, or a stochastic rule leaves it be. */
function rewriteAt(rules: readonly Rule[], n: Neighbors, i: number, rng: Rng): Module[] | null {
  const m = n.ms[i]!;
  for (const rule of rules) {
    if (!fits(m, rule.pred)) continue;
    const left = rule.left ? leftOf(n, i, rule.left) : [];
    if (!left) continue;
    const right = rule.right ? rightOf(n, i, rule.right) : [];
    if (!right) continue;
    const bound = rule.left || rule.right || rule.pred.params.length > 0 || rule.condition ? env(n.ms, [...left, i, ...right]) : [];
    if (rule.condition && !rule.condition.eval(bound)) continue;
    const body = choose(rule, rng);
    if (!body) return null;
    return body.map((t) => (t.args ? { symbol: t.symbol, params: t.args.map((a) => a.eval(bound)) } : t));
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
  const none = new Int32Array(0);
  for (let g = 1; g <= n; g++) {
    const prev = out[g - 1]!;
    const near: Neighbors = { ms: prev, pair: grammar.contextual ? partners(prev) : none, ignore: grammar.ignore };
    const next: Module[] = [];
    for (let i = 0; i < prev.length; i++) {
      const m = prev[i]!;
      const rules = grammar.rules[m.symbol];
      const body = rules ? rewriteAt(rules, near, i, rng) : null;
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

const num = (v: number) => (Number.isInteger(v) ? String(v) : String(+v.toFixed(3)));

/** One module as ABOP writes it: `F`, or `A(1,0.5)`. */
export const moduleString = (m: Module): string => (m.params ? `${m.symbol}(${m.params.map(num).join(',')})` : m.symbol);

export const moduleText = (ms: readonly Module[]): string => ms.map(moduleString).join('');

/** A successor as written: `F(l*r)[+A]`. */
export const templateText = (ts: readonly ModuleTemplate[]): string =>
  ts.map((t) => (t.args ? `${t.symbol}(${t.args.map((a) => a.text).join(',')})` : t.symbol)).join('');
