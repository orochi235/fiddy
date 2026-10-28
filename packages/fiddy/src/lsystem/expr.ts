import { ParseError } from './types.js';

/** A compiled expression: reads module parameters from `env` by the slots its scope gave them. */
export interface Expr {
  text: string;
  eval: (env: readonly number[]) => number;
}

/** What a name in an expression means: a formal parameter's slot in `env`, or a constant. */
export interface Scope {
  slots: ReadonlyMap<string, number>;
  constants: Readonly<Record<string, number>>;
}

const RAD = Math.PI / 180;

/** Trigonometry is in degrees, like the turtle's angles. */
const FUNCTIONS: Record<string, (...a: number[]) => number> = {
  sin: (x) => Math.sin(x * RAD),
  cos: (x) => Math.cos(x * RAD),
  tan: (x) => Math.tan(x * RAD),
  asin: (x) => Math.asin(x) / RAD,
  acos: (x) => Math.acos(x) / RAD,
  atan: (x) => Math.atan(x) / RAD,
  atan2: (y, x) => Math.atan2(y, x) / RAD,
  sqrt: Math.sqrt,
  abs: Math.abs,
  exp: Math.exp,
  log: Math.log,
  floor: Math.floor,
  ceil: Math.ceil,
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
};

type Fn = (env: readonly number[]) => number;
type Tok = { kind: 'num' | 'name' | 'op'; text: string; at: number };

const OPS = ['&&', '||', '==', '!=', '<=', '>=', '+', '-', '*', '/', '%', '^', '<', '>', '!', '(', ')', ',', '?', ':'];

function tokenize(src: string, line: number, col: number): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const num = /^(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i.exec(src.slice(i));
    if (num) {
      out.push({ kind: 'num', text: num[0], at: i });
      i += num[0].length;
      continue;
    }
    const name = /^[A-Za-z_]\w*/.exec(src.slice(i));
    if (name) {
      out.push({ kind: 'name', text: name[0], at: i });
      i += name[0].length;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new ParseError(`unexpected "${ch}" in an expression`, line, col + i);
    out.push({ kind: 'op', text: op, at: i });
    i += op.length;
  }
  return out;
}

const BINARY: Record<string, [number, (a: number, b: number) => number]> = {
  '||': [1, (a, b) => (a || b ? 1 : 0)],
  '&&': [2, (a, b) => (a && b ? 1 : 0)],
  '==': [3, (a, b) => (a === b ? 1 : 0)],
  '!=': [3, (a, b) => (a !== b ? 1 : 0)],
  '<': [4, (a, b) => (a < b ? 1 : 0)],
  '<=': [4, (a, b) => (a <= b ? 1 : 0)],
  '>': [4, (a, b) => (a > b ? 1 : 0)],
  '>=': [4, (a, b) => (a >= b ? 1 : 0)],
  '+': [5, (a, b) => a + b],
  '-': [5, (a, b) => a - b],
  '*': [6, (a, b) => a * b],
  '/': [6, (a, b) => a / b],
  '%': [6, (a, b) => a % b],
};

/** Compiles `src`, written at `line`:`col`, against `scope`. */
export function compile(src: string, scope: Scope, line: number, col: number): Expr {
  const toks = tokenize(src, line, col);
  let k = 0;
  const fail = (msg: string, t = toks[k]): never => {
    throw new ParseError(msg, line, col + (t ? t.at : src.length));
  };
  const peek = (text: string) => toks[k]?.kind === 'op' && toks[k]!.text === text;
  const expect = (text: string) => {
    if (!peek(text)) fail(`expected "${text}"`);
    k++;
  };

  const ternary = (): Fn => {
    const cond = binary(1);
    if (!peek('?')) return cond;
    k++;
    const yes = ternary();
    expect(':');
    const no = ternary();
    return (e) => (cond(e) ? yes(e) : no(e));
  };

  const binary = (min: number): Fn => {
    let left = unary();
    for (;;) {
      const t = toks[k];
      const op = t?.kind === 'op' ? BINARY[t.text] : undefined;
      if (!op || op[0] < min) return left;
      k++;
      const right = binary(op[0] + 1);
      const [, f] = op;
      const l = left;
      left = (e) => f(l(e), right(e));
    }
  };

  const unary = (): Fn => {
    if (peek('-')) {
      k++;
      const a = unary();
      return (e) => -a(e);
    }
    if (peek('!')) {
      k++;
      const a = unary();
      return (e) => (a(e) ? 0 : 1);
    }
    return power();
  };

  const power = (): Fn => {
    const base = atom();
    if (!peek('^')) return base;
    k++;
    const exp = unary();
    return (e) => base(e) ** exp(e);
  };

  const atom = (): Fn => {
    const t = toks[k];
    if (!t) return fail('the expression ends early');
    k++;
    if (t.kind === 'num') {
      const v = Number(t.text);
      return () => v;
    }
    if (t.kind === 'name') {
      if (peek('(')) {
        const f = FUNCTIONS[t.text];
        if (!f) return fail(`no function "${t.text}"`, t);
        k++;
        const args: Fn[] = [];
        if (!peek(')')) {
          args.push(ternary());
          while (peek(',')) {
            k++;
            args.push(ternary());
          }
        }
        expect(')');
        return (e) => f(...args.map((a) => a(e)));
      }
      const slot = scope.slots.get(t.text);
      if (slot !== undefined) return (e) => e[slot]!;
      const c = scope.constants[t.text];
      if (c !== undefined) return () => c;
      return fail(`"${t.text}" is not a parameter of this rule or a #define`, t);
    }
    if (t.text === '(') {
      const inner = ternary();
      expect(')');
      return inner;
    }
    return fail(`unexpected "${t.text}"`, t);
  };

  if (toks.length === 0) fail('an empty expression');
  const fn = ternary();
  if (k < toks.length) fail(`unexpected "${toks[k]!.text}"`);
  return { text: src.trim(), eval: fn };
}
