import { KINDS, lsystemParams, type Motion, paramsOf, type Selector, type Stage, takeDefines } from 'fiddy';
import type { Hover } from '../tree/draw';
import { GrammarPanel } from './GrammarPanel';
import { NumberField } from './NumberField';
import './Inspector.css';

interface Props {
  stage: Stage | null;
  hover: Hover | null;
  onHover: (hover: Hover | null) => void;
  onStage: (next: Stage) => void;
  onAdd: (kind: string) => void;
  onRemove: () => void;
}

const SELECTOR_FIELDS: readonly { key: keyof Selector; label: string; step: number }[] = [
  { key: 'minOrder', label: 'order ≥', step: 1 },
  { key: 'maxOrder', label: 'order ≤', step: 1 },
  { key: 'minHeight', label: 'height ≥', step: 0.05 },
  { key: 'maxHeight', label: 'height ≤', step: 0.05 },
];

/** The selected stage: which buds it grows from, its params, and for an L-system its grammar. */
export function Inspector({ stage, hover, onHover, onStage, onAdd, onRemove }: Props) {
  if (!stage) return <aside className="fd-inspector fd-inspector--empty">Select a stage in the pipeline.</aside>;
  const kind = KINDS[stage.kind];
  const values = paramsOf(stage);

  const setParam = (key: string, value: Stage['params'][string]) => onStage({ ...stage, params: { ...stage.params, [key]: value } });
  const setMotion = (key: string, motion: Motion | undefined) => {
    const next = { ...stage.motion };
    if (motion) next[key] = motion;
    else delete next[key];
    onStage({ ...stage, motion: next });
  };
  const setSelect = (key: keyof Selector, raw: string) => {
    const select: Selector = { ...stage.input.select };
    if (raw === '' || !Number.isFinite(Number(raw))) delete select[key];
    else select[key] = Number(raw);
    onStage({ ...stage, input: { ...stage.input, select } });
  };
  const setGrammar = (text: string) => {
    const { source, defines } = takeDefines(text);
    onStage({
      ...stage,
      params: { ...stage.params, grammar: source, ...(defines.n !== undefined ? { n: defines.n } : {}), ...(defines.delta !== undefined ? { delta: defines.delta } : {}) },
    });
  };

  return (
    <aside className="fd-inspector">
      <header className="fd-inspector-head">
        <h3>{kind?.title ?? stage.kind}</h3>
        <code>{stage.id}</code>
      </header>

      <section className="fd-inspector-section">
        <h4>Grows from</h4>
        <div className="fd-select">
          {SELECTOR_FIELDS.map((f) => (
            <label key={f.key}>
              <span>{f.label}</span>
              <input type="number" step={f.step} placeholder="any" value={stage.input.select?.[f.key] ?? ''} onChange={(e) => setSelect(f.key, e.target.value)} />
            </label>
          ))}
        </div>
      </section>

      <section className="fd-inspector-section">
        <h4>Settings</h4>
        {kind?.params.map((spec) =>
          spec.type === 'number' ? (
            <NumberField
              key={spec.key}
              spec={spec}
              value={values[spec.key] as number}
              motion={stage.motion?.[spec.key]}
              onValue={(v) => setParam(spec.key, v)}
              onMotion={(m) => setMotion(spec.key, m)}
            />
          ) : null,
        )}
      </section>

      {stage.kind === 'lsystem' && (
        <section className="fd-inspector-section">
          <h4>Grammar</h4>
          <GrammarPanel stage={stage.id} {...grammarProps(values)} hover={hover} onHover={onHover} onText={setGrammar} />
        </section>
      )}

      <footer className="fd-inspector-actions">
        <button type="button" onClick={() => onAdd('lsystem')}>Add L-system after</button>
        <button type="button" onClick={() => onAdd('seed')}>Add seed after</button>
        <button type="button" className="fd-danger" onClick={onRemove}>Remove</button>
      </footer>
    </aside>
  );
}

function grammarProps(values: Stage['params']) {
  const p = lsystemParams(values);
  return { text: p.grammar, n: p.n, delta: p.delta, cap: p.cap };
}
