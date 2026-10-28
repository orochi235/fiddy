import { derivationSeeds, generationsOf, grammarOf, type Grammar, type Module, moduleString, ParseError, streamFor, templateText } from 'fiddy';
import { useMemo } from 'react';
import type { Hover } from '../tree/draw';
import { Thumb } from './Thumb';
import { SKETCH_CAP, turtleSketch } from './turtleSketch';
import './GrammarPanel.css';

interface Props {
  stage: string;
  seed: number;
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
 *  generation drawn, and the final string, linked to the tree by hover. A stochastic grammar
 *  derives a string per bud; the views show the first bud's. */
export function GrammarPanel({ stage, seed, text, n, delta, cap, hover, onHover, onText }: Props) {
  const result = useMemo(() => parsed(text), [text]);
  const bud = 'grammar' in result && result.grammar.stochastic ? 0 : undefined;
  const gens = useMemo((): Module[][] | Error | null => {
    if (!('grammar' in result)) return null;
    try {
      return generationsOf(text, n, cap, derivationSeeds(text, streamFor(seed, stage), 1)[0]);
    } catch (e) {
      return e as Error;
    }
  }, [result, text, n, cap, seed, stage]);
  const of = bud === undefined ? '' : ', first bud';

  return (
    <div className="fd-grammar">
      <textarea className="fd-grammar-text" spellCheck={false} rows={Math.max(3, text.split('\n').length + 1)} value={text} onChange={(e) => onText(e.target.value)} />
      {'error' in result && <ErrorAt text={text} error={result.error} />}
      {'grammar' in result && <RulePictures grammar={result.grammar} delta={delta} />}
      {gens instanceof Error && <p className="fd-grammar-error">{gens.message}</p>}
      {Array.isArray(gens) && (
        <>
          <Generations gens={gens} delta={delta} title={`Generations${of}`} />
          <LinkedString stage={stage} bud={bud} modules={gens.at(-1)!} hover={hover} onHover={onHover} title={`String${of}`} />
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
  const rows = useMemo(
    () => Object.values(grammar.rules).flatMap((rs) => rs.flatMap((r) => r.succ.map((alt, i) => ({ key: `${r.line}:${r.lhs}:${i}`, lhs: r.lhs, alt, sketch: turtleSketch(alt.body, delta) })))),
    [grammar, delta],
  );
  return (
    <section className="fd-grammar-section">
      <h4>Rules</h4>
      <div className="fd-rules">
        {rows.map(({ key, lhs, alt, sketch }) => (
          <div key={key} className="fd-rule">
            <span className="fd-rule-pred">{lhs}</span>
            <span className="fd-rule-arrow">
              →{alt.prob !== undefined && <small className="fd-rule-prob">{alt.prob.toFixed(2)}</small>}
            </span>
            <Thumb skeleton={sketch} size={56} className="fd-thumb" />
            <code className="fd-rule-text">{templateText(alt.body)}</code>
          </div>
        ))}
      </div>
    </section>
  );
}

function Generations({ gens, delta, title }: { gens: Module[][]; delta: number; title: string }) {
  const sketches = useMemo(() => gens.map((g) => (g.length <= SKETCH_CAP ? turtleSketch(g, delta) : null)), [gens, delta]);
  return (
    <section className="fd-grammar-section">
      <h4>{title}</h4>
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

interface LinkedProps {
  stage: string;
  bud: number | undefined;
  modules: Module[];
  hover: Hover | null;
  onHover: (h: Hover | null) => void;
  title: string;
}

function LinkedString({ stage, bud, modules, hover, onHover, title }: LinkedProps) {
  const lit = hover?.stage === stage && hover.bud === bud ? hover.module : -1;
  const shown = modules.slice(0, STRING_SHOWN);
  return (
    <section className="fd-grammar-section">
      <h4>{title}</h4>
      <p className="fd-string" onPointerLeave={() => onHover(null)}>
        {shown.map((m, i) => (
          <span key={i} className={i === lit ? 'fd-mod fd-mod--lit' : 'fd-mod'} onPointerEnter={() => onHover({ stage, module: i, bud })}>
            {moduleString(m)}
          </span>
        ))}
        {modules.length > STRING_SHOWN && <span className="fd-string-more"> … {(modules.length - STRING_SHOWN).toLocaleString('en-US')} more</span>}
      </p>
    </section>
  );
}
