import { type Grammar, type Module, ParseError, type Rule } from './types.js';

const ARROW = /→|->/;
const AXIOM = /^(?:ω|w|omega|axiom)\s*:/i;
const LABEL = /^p\d*\s*:/i;
const DEFINE = /(n|δ|delta|angle)\s*=\s*([-+]?\d*\.?\d+)\s*°?/gi;

const LATER = {
  stochastic: 'probabilities are stochastic rules, which arrive in roadmap piece 3',
  parametric: 'module parameters are parametric rules, which arrive in roadmap piece 4',
  condition: 'conditions are parametric rules, which arrive in roadmap piece 4',
  context: 'context (< and >) is context-sensitive rules, which arrive in roadmap piece 5',
  several: 'a second rule for one symbol makes the grammar stochastic, which arrives in roadmap piece 3',
};

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

/** Parses a grammar in ABOP's notation: `ω:` (or `w:`) for the axiom, `p1:` labels optional,
 *  `→` or `->`, and `n = …` and `δ = …` defines anywhere. `#` and `//` start comments. Syntax
 *  from later roadmap pieces is refused with its position rather than misread. */
export function parseGrammar(source: string): Grammar {
  const grammar: Grammar = { axiom: [], rules: {}, defines: {} };
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
    const lhs = body.slice(0, arrow.index);
    const rhsAt = arrow.index + arrow[0].length;

    const prob = lhs.match(/\(\s*[\d.]+\s*\)\s*$/);
    if (prob?.index !== undefined) throw new ParseError(LATER.stochastic, line, col + prob.index);
    for (const [ch, why] of [['(', LATER.parametric], [':', LATER.condition], ['<', LATER.context], ['>', LATER.context]] as const) {
      const at = lhs.indexOf(ch);
      if (at >= 0) throw new ParseError(why, line, col + at);
    }
    const pred = lhs.trim();
    const predAt = col + lhs.indexOf(pred);
    if ([...pred].length !== 1) throw new ParseError(`a rule rewrites one symbol, not "${pred}"`, line, predAt);
    if (grammar.rules[pred]) throw new ParseError(LATER.several, line, predAt);

    const rule: Rule = { pred: { symbol: pred }, succ: [{ body: modules(body.slice(rhsAt), line, col + rhsAt) }], line };
    grammar.rules[pred] = rule;
  }
  if (!sawAxiom) throw new ParseError('no axiom: write one as ω: …', 1, 1);
  return grammar;
}
