import { type Grammar, type Module, ParseError, type Rule } from './types.js';

const ARROW = /→|->/;
const AXIOM = /^(?:ω|w|omega|axiom)\s*:/i;
const LABEL = /^p\d*\s*:/i;
const DEFINE = /(n|δ|delta|angle)\s*=\s*([-+]?\d*\.?\d+)\s*°?/gi;

const LATER = {
  parametric: 'module parameters are parametric rules, which arrive in roadmap piece 4',
  condition: 'conditions are parametric rules, which arrive in roadmap piece 4',
  context: 'context (< and >) is context-sensitive rules, which arrive in roadmap piece 5',
};

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

/** The modules of `text`, one per non-space character; `col` is where `text` starts on its line. */
function modules(text: string, line: number, col: number): Module[] {
  const out: Module[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (/\s/.test(ch)) continue;
    if (ch === '(') throw new ParseError(LATER.parametric, line, col + i);
    out.push({ symbol: ch });
  }
  return out;
}

/** Fills in every alternative's `prob` once a rule has more than one or any is written: the
 *  unwritten ones split what the written ones leave, evenly. */
function settle(rule: Rule, written: (number | undefined)[]): void {
  if (rule.succ.length === 1 && written[0] === undefined) return;
  const given = written.reduce<number>((a, p) => a + (p ?? 0), 0);
  if (given > 1 + 1e-9) throw new ParseError(`the probabilities for ${rule.pred.symbol} add up to ${+given.toFixed(6)}, more than 1`, rule.line, 1);
  const open = written.filter((p) => p === undefined).length;
  rule.succ.forEach((alt, i) => {
    alt.prob = written[i] ?? (1 - given) / open;
  });
}

/** Parses a grammar in ABOP's notation: `ω:` (or `w:`) for the axiom, `p1:` labels optional,
 *  `→` or `->`, and `n = …` and `δ = …` defines anywhere. `#` and `//` start comments. Several
 *  rules for one symbol are a stochastic choice, each optionally weighted as `F (0.33) → …`.
 *  Syntax from later roadmap pieces is refused with its position rather than misread. */
export function parseGrammar(source: string): Grammar {
  const grammar: Grammar = { axiom: [], rules: {}, defines: {}, stochastic: false };
  const written = new Map<string, (number | undefined)[]>();
  let sawAxiom = false;
  const lines = source.split('\n');
  for (let li = 0; li < lines.length; li++) {
    const line = li + 1;
    let text = lines[li]!.replace(/(#|\/\/).*$/, '');
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
      grammar.axiom = modules(body.slice(axiom[0].length), line, col + axiom[0].length);
      continue;
    }

    const label = body.match(LABEL);
    if (label) {
      col += label[0].length;
      body = body.slice(label[0].length);
    }
    const arrow = body.match(ARROW);
    if (!arrow || arrow.index === undefined) throw new ParseError('expected a rule (A → …) or an axiom (ω: …)', line, col);
    let lhs = body.slice(0, arrow.index);
    const rhsAt = arrow.index + arrow[0].length;

    let prob: number | undefined;
    const weight = lhs.match(/\(\s*([^()]*?)\s*\)\s*$/);
    if (weight?.index !== undefined && /^\s*\S\s+$/.test(lhs.slice(0, weight.index))) {
      prob = Number(weight[1]);
      if (!/^\d*\.?\d+$/.test(weight[1]!) || prob > 1) throw new ParseError(`a probability is a number from 0 to 1, not "${weight[1]}"`, line, col + weight.index + 1);
      lhs = lhs.slice(0, weight.index);
    }
    for (const [ch, why] of [['(', LATER.parametric], [':', LATER.condition], ['<', LATER.context], ['>', LATER.context]] as const) {
      const at = lhs.indexOf(ch);
      if (at >= 0) throw new ParseError(why, line, col + at);
    }
    const pred = lhs.trim();
    const predAt = col + lhs.indexOf(pred);
    if ([...pred].length !== 1) throw new ParseError(`a rule rewrites one symbol, not "${pred}"`, line, predAt);

    const alt = { body: modules(body.slice(rhsAt), line, col + rhsAt) };
    const rule: Rule = grammar.rules[pred] ?? { pred: { symbol: pred }, succ: [], line };
    rule.succ.push(alt);
    grammar.rules[pred] = rule;
    written.set(pred, [...(written.get(pred) ?? []), prob]);
  }
  if (!sawAxiom) throw new ParseError('no axiom: write one as ω: …', 1, 1);
  for (const rule of Object.values(grammar.rules)) {
    settle(rule, written.get(rule.pred.symbol)!);
    if (rule.succ[0]!.prob !== undefined) grammar.stochastic = true;
  }
  return grammar;
}
