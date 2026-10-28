import { compile, type Scope } from './expr.js';
import { type Grammar, type Module, type ModuleTemplate, ParseError, type Pattern, type Rule } from './types.js';

const ARROW = /→|->/;
const AXIOM = /^(?:ω|w|omega|axiom)\s*:/i;
const LABEL = /^p\d*\s*:/i;
const DEFINE = /(?<!\w)(n|δ|delta|angle)\s*=\s*([-+]?\d*\.?\d+)\s*°?/gi;
const CONSTANT = /^#define\s+([A-Za-z_]\w*)\s+(.+)$/;
const IGNORE = /^#ignore\b\s*:?/;
const WEIGHT = /\s\(\s*([^()]*?)\s*\)\s*$/;

/** The `n = …` and `δ = …` defines in `source`, and the source with them taken out and any line
 *  they leave empty dropped: how a grammar pasted from the book becomes a grammar and params. */
export function takeDefines(source: string): { source: string; defines: Grammar['defines'] } {
  const defines: Grammar['defines'] = {};
  const lines: string[] = [];
  for (const line of source.split('\n')) {
    let found = false;
    for (const m of line.matchAll(DEFINE)) {
      found = true;
      if (m[1]!.toLowerCase() === 'n') defines.n = Number(m[2]);
      else defines.delta = Number(m[2]);
    }
    const rest = line.replace(DEFINE, '').trimEnd();
    if (!found || rest.trim() !== '') lines.push(found ? rest.trim() : line);
  }
  return { source: lines.join('\n'), defines };
}

/** `line` with `/* … *\/` blanked and anything from a `#` that is not a directive cut, columns kept. */
function uncomment(line: string): string {
  const blanked = line.replace(/\/\*.*?\*\//g, (m) => ' '.repeat(m.length));
  if (/^\s*#(define|ignore)\b/.test(blanked)) return blanked;
  const hash = blanked.indexOf('#');
  return hash < 0 ? blanked : blanked.slice(0, hash);
}

/** The index of the first of `chars` outside parentheses in `text`, or -1. */
function findTop(text: string, chars: string): number {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0 && chars.includes(ch)) return i;
  }
  return -1;
}

/** The index of the `)` that closes the `(` at `open`, or -1. */
function closing(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return i;
  }
  return -1;
}

interface Written {
  symbol: string;
  args?: { text: string; col: number }[];
  col: number;
}

/** The modules of `text`, one per non-space character, each with the argument list that follows
 *  it directly, if any; `col` is where `text` starts on its line. */
function modules(text: string, line: number, col: number): Written[] {
  const out: Written[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '(' || ch === ')') throw new ParseError(`"${ch}" with no module before it`, line, col + i);
    const w: Written = { symbol: ch, col: col + i };
    i++;
    if (text[i] === '(') {
      const close = closing(text, i);
      if (close < 0) throw new ParseError('an unclosed "("', line, col + i);
      w.args = [];
      let start = i + 1;
      const inner = text.slice(start, close);
      for (;;) {
        const comma = findTop(text.slice(start, close), ',');
        const end = comma < 0 ? close : start + comma;
        w.args.push({ text: text.slice(start, end), col: col + start });
        if (comma < 0) break;
        start = end + 1;
      }
      if (inner.trim() === '') w.args = [];
      i = close + 1;
    }
    out.push(w);
  }
  return out;
}

const NAME = /^\s*[A-Za-z_]\w*\s*$/;

function patterns(text: string, line: number, col: number): Pattern[] {
  return modules(text, line, col).map((w) => ({
    symbol: w.symbol,
    params: (w.args ?? []).map((a) => {
      if (!NAME.test(a.text)) throw new ParseError(`a predecessor's parameters are names, not "${a.text.trim()}"`, line, a.col);
      return a.text.trim();
    }),
  }));
}

const isAny = (text: string) => text.trim() === '*';

/** Fills in every alternative's `prob` once a rule has more than one or any is written: the
 *  unwritten ones split what the written ones leave, evenly. */
function settle(rule: Rule, written: (number | undefined)[]): void {
  if (rule.succ.length === 1 && written[0] === undefined) return;
  const given = written.reduce<number>((a, p) => a + (p ?? 0), 0);
  if (given > 1 + 1e-9) throw new ParseError(`the probabilities for ${rule.lhs} add up to ${+given.toFixed(6)}, more than 1`, rule.line, 1);
  const open = written.filter((p) => p === undefined).length;
  rule.succ.forEach((alt, i) => {
    alt.prob = written[i] ?? (1 - given) / open;
  });
}

interface Lhs {
  pred: Pattern;
  left?: Pattern[];
  right?: Pattern[];
  condition?: { text: string; col: number };
  prob?: number;
  key: string;
  /** Where the predecessor is written. */
  at: number;
}

/** A rule's left side: `[left <] pred [> right] [: condition] [(probability)]`. */
function leftSide(lhs: string, line: number, col: number): Lhs {
  let text = lhs;
  let prob: number | undefined;
  const weight = WEIGHT.exec(text);
  if (weight && /^\s*\d*\.?\d+\s*$/.test(weight[1]!)) {
    prob = Number(weight[1]);
    if (prob > 1) throw new ParseError(`a probability is a number from 0 to 1, not "${weight[1]}"`, line, col + weight.index + 2);
    text = text.slice(0, weight.index);
  }
  const colon = findTop(text, ':');
  const head = colon < 0 ? text : text.slice(0, colon);
  const cond = colon < 0 ? '' : text.slice(colon + 1);

  const lt = findTop(head, '<');
  const gt = findTop(head, '>');
  const predStart = lt < 0 ? 0 : lt + 1;
  const predEnd = gt < 0 ? head.length : gt;
  if (gt >= 0 && gt < predStart) throw new ParseError('">" before "<"', line, col + gt);
  const predText = head.slice(predStart, predEnd);
  const pred = patterns(predText, line, col + predStart);
  if (pred.length !== 1 || pred[0]!.symbol === '*') {
    throw new ParseError(`a rule rewrites one module, not "${predText.trim()}"`, line, col + predStart);
  }
  const at = col + predStart + predText.length - predText.trimStart().length;
  const out: Lhs = { pred: pred[0]!, at, key: `${head.replace(/\s+/g, '')}:${isAny(cond) ? '' : cond.replace(/\s+/g, '')}` };
  if (lt >= 0 && !isAny(head.slice(0, lt))) out.left = patterns(head.slice(0, lt), line, col);
  if (gt >= 0 && !isAny(head.slice(gt + 1))) out.right = patterns(head.slice(gt + 1), line, col + gt + 1);
  if (cond.trim() !== '' && !isAny(cond)) out.condition = { text: cond, col: col + colon + 1 };
  if (prob !== undefined) out.prob = prob;
  return out;
}

/** The slots a rule's formals take in the rewriter's environment: left context, predecessor,
 *  then right context, in reading order. */
export function formals(rule: Pick<Rule, 'left' | 'pred' | 'right'>): string[] {
  return [...(rule.left ?? []), rule.pred, ...(rule.right ?? [])].flatMap((p) => p.params);
}

/** Parses a grammar in ABOP's notation: `ω:` (or `w:`) for the axiom, `p1:` labels optional,
 *  `→` or `->`, `n = …` and `δ = …` anywhere, `#define` constants and `#ignore` symbols. Modules
 *  take parameters, `A(l, w)`; a rule is `[left <] pred [> right] [: condition] [(prob)] → succ`.
 *  `#` (outside a directive) and `/* *\/` are comments. */
export function parseGrammar(source: string): Grammar {
  const grammar: Grammar = { axiom: [], rules: {}, constants: {}, ignore: new Set(), defines: {}, stochastic: false, contextual: false };
  const ignore = new Set<string>();
  const byKey = new Map<string, Rule>();
  const written = new Map<Rule, (number | undefined)[]>();
  const empty: Scope = { slots: new Map(), constants: grammar.constants };
  let sawAxiom = false;

  const lines = source.split('\n').map(uncomment);
  // Constants first: ABOP lists them above the rules, but a rule may come before its #define.
  lines.forEach((text, li) => {
    const m = CONSTANT.exec(text.trim());
    if (!m) return;
    const at = text.indexOf(m[2]!) + 1;
    grammar.constants[m[1]!] = compile(m[2]!, empty, li + 1, at).eval([]);
  });

  for (let li = 0; li < lines.length; li++) {
    const line = li + 1;
    let text = lines[li]!;
    if (CONSTANT.test(text.trim())) continue;
    const ig = IGNORE.exec(text.trim());
    if (ig) {
      for (const ch of text.trim().slice(ig[0].length)) if (!/\s/.test(ch)) ignore.add(ch);
      continue;
    }
    for (const m of text.matchAll(DEFINE)) {
      const value = Number(m[2]);
      if (m[1]!.toLowerCase() === 'n') grammar.defines.n = value;
      else grammar.defines.delta = value;
    }
    text = text.replace(DEFINE, (m) => ' '.repeat(m.length));
    const indent = text.length - text.trimStart().length;
    let body = text.trim();
    if (body === '') continue;
    let col = indent + 1;

    const axiom = body.match(AXIOM);
    if (axiom) {
      if (sawAxiom) throw new ParseError('a second axiom', line, col);
      sawAxiom = true;
      grammar.axiom = modules(body.slice(axiom[0].length), line, col + axiom[0].length).map(
        (w): Module => (w.args ? { symbol: w.symbol, params: w.args.map((a) => compile(a.text, empty, line, a.col).eval([])) } : { symbol: w.symbol }),
      );
      continue;
    }

    const label = body.match(LABEL);
    if (label) {
      col += label[0].length;
      body = body.slice(label[0].length);
    }
    const arrow = body.match(ARROW);
    if (!arrow || arrow.index === undefined) throw new ParseError('expected a rule (A → …) or an axiom (ω: …)', line, col);
    const lhs = leftSide(body.slice(0, arrow.index), line, col);
    const rhsAt = arrow.index + arrow[0].length;

    let rule = byKey.get(lhs.key);
    if (!rule) {
      rule = { pred: lhs.pred, succ: [], lhs: body.slice(0, arrow.index).replace(WEIGHT, '').trim(), line };
      if (lhs.left) rule.left = lhs.left;
      if (lhs.right) rule.right = lhs.right;
      const names = formals(rule);
      const dup = names.find((n, i) => names.indexOf(n) !== i);
      if (dup) throw new ParseError(`the parameter "${dup}" is named twice`, line, lhs.at);
      if (lhs.condition) rule.condition = compile(lhs.condition.text, scopeOf(names, grammar.constants), line, lhs.condition.col);
      byKey.set(lhs.key, rule);
      (grammar.rules[lhs.pred.symbol] ??= []).push(rule);
      written.set(rule, []);
    }
    const scope = scopeOf(formals(rule), grammar.constants);
    const body2 = modules(body.slice(rhsAt), line, col + rhsAt).map(
      (w): ModuleTemplate => (w.args ? { symbol: w.symbol, args: w.args.map((a) => compile(a.text, scope, line, a.col)) } : { symbol: w.symbol }),
    );
    rule.succ.push({ body: body2 });
    written.get(rule)!.push(lhs.prob);
  }
  if (!sawAxiom) throw new ParseError('no axiom: write one as ω: …', 1, 1);
  for (const [rule, probs] of written) {
    settle(rule, probs);
    if (rule.succ[0]!.prob !== undefined) grammar.stochastic = true;
    if (rule.left || rule.right) grammar.contextual = true;
  }
  grammar.ignore = ignore;
  return grammar;
}

const scopeOf = (names: readonly string[], constants: Record<string, number>): Scope => ({
  slots: new Map(names.map((n, i) => [n, i])),
  constants,
});
