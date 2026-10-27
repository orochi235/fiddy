import { generationsOf, grammarOf, type Grammar, type Module, moduleText, ParseError } from 'fiddy';
import { useMemo } from 'react';
import type { Hover } from '../tree/draw';
import { Thumb } from './Thumb';
import { SKETCH_CAP, turtleSketch } from './turtleSketch';
import './GrammarPanel.css';

interface Props {
  stage: string;
  text: string;
  n: number;
  delta: number;
  cap: number;
  hover: Hover | null;
  onHover: (hover: Hover | null) => void;
  onText: (text: string) => void;
}

/** The longest string the linked view lists; past it, the rest is counted. */
const STRING_SHOWN = 3000;

function parsed(text: string): { grammar: Grammar } | { error: ParseError | Error } {
  try {
    return { grammar: grammarOf(text) };
  } catch (e) {
    return { error: e as Error };
  }
}

/** Where the grammar is written, and three pictures of it: each rule's successor drawn, every
 *  generation drawn, and the final string, linked to the tree by hover. */
export function GrammarPanel({ stage, text, n, delta, cap, hover, onHover, onText }: Props) {
  const result = useMemo(() => parsed(text), [text]);
  const gens = useMemo((): Module[][] | Error | null => {
    if (!('grammar' in result)) return null;
    try {
      return generationsOf(text, n, cap);
    } catch (e) {
      return e as Error;
    }
  }, [result, text, n, cap]);

  return (
    <div className="fd-grammar">
      <textarea className="fd-grammar-text" spellCheck={false} rows={Math.max(3, text.split('\n').length + 1)} value={text} onChange={(e) => onText(e.target.value)} />
      {'error' in result && <ErrorAt text={text} error={result.error} />}
      {'grammar' in result && <RulePictures grammar={result.grammar} delta={delta} />}
      {gens instanceof Error && <p className="fd-grammar-error">{gens.message}</p>}
      {Array.isArray(gens) && (
        <>
          <Generations gens={gens} delta={delta} />
          <LinkedString stage={stage} modules={gens.at(-1)!} hover={hover} onHover={onHover} />
        </>
      )}
    </div>
  );
}

function ErrorAt({ text, error }: { text: string; error: Error }) {
  if (!(error instanceof ParseError)) return <p className="fd-grammar-error">{error.message}</p>;
  const line = text.split('\n')[error.line - 1] ?? '';
  return (
    <div className="fd-grammar-error">
      <pre className="fd-grammar-caret">
        {line}
        {'\n'}
        {' '.repeat(Math.max(0, error.col - 1))}^
      </pre>
      <p>
        line {error.line}, column {error.col}: {error.message.replace(/^\d+:\d+: /, '')}
      </p>
    </div>
  );
}

function RulePictures({ grammar, delta }: { grammar: Grammar; delta: number }) {
  const rules = useMemo(() => Object.values(grammar.rules).map((r) => ({ rule: r, sketch: turtleSketch(r.succ[0]!.body, delta) })), [grammar, delta]);
  return (
    <section className="fd-grammar-section">
      <h4>Rules</h4>
      <div className="fd-rules">
        {rules.map(({ rule: r, sketch }) => (
          <div key={r.pred.symbol} className="fd-rule">
            <span className="fd-rule-pred">{r.pred.symbol}</span>
            <span className="fd-rule-arrow">→</span>
            <Thumb skeleton={sketch} size={56} className="fd-thumb" />
            <code className="fd-rule-text">{moduleText(r.succ[0]!.body)}</code>
          </div>
        ))}
      </div>
    </section>
  );
}

function Generations({ gens, delta }: { gens: Module[][]; delta: number }) {
  const sketches = useMemo(() => gens.map((g) => (g.length <= SKETCH_CAP ? turtleSketch(g, delta) : null)), [gens, delta]);
  return (
    <section className="fd-grammar-section">
      <h4>Generations</h4>
      <div className="fd-gens">
        {gens.map((g, i) => (
          <figure key={i} className="fd-gen">
            {sketches[i] ? <Thumb skeleton={sketches[i]} size={56} className="fd-thumb" /> : <div className="fd-thumb fd-thumb--big" />}
            <figcaption>
              n={i} · {g.length.toLocaleString('en-US')}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function LinkedString({ stage, modules, hover, onHover }: { stage: string; modules: Module[]; hover: Hover | null; onHover: (h: Hover | null) => void }) {
  const lit = hover?.stage === stage ? hover.module : -1;
  const shown = modules.slice(0, STRING_SHOWN);
  return (
    <section className="fd-grammar-section">
      <h4>String</h4>
      <p className="fd-string" onPointerLeave={() => onHover(null)}>
        {shown.map((m, i) => (
          <span key={i} className={i === lit ? 'fd-mod fd-mod--lit' : 'fd-mod'} onPointerEnter={() => onHover({ stage, module: i })}>
            {m.symbol}
          </span>
        ))}
        {modules.length > STRING_SHOWN && <span className="fd-string-more"> … {(modules.length - STRING_SHOWN).toLocaleString('en-US')} more</span>}
      </p>
    </section>
  );
}
