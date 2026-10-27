import { type Motion, newMotion, type ParamSpec } from 'fiddy';
import './NumberField.css';

type NumberSpec = Extract<ParamSpec, { type: 'number' }>;

interface Props {
  spec: NumberSpec;
  value: number;
  motion: Motion | undefined;
  onValue: (value: number) => void;
  onMotion: (motion: Motion | undefined) => void;
}

/** One number param: a slider and a box, and `~` to make it swing over the loop. */
export function NumberField({ spec, value, motion, onValue, onMotion }: Props) {
  const set = (raw: string) => {
    const v = Number(raw);
    if (Number.isFinite(v)) onValue(Math.min(spec.max, Math.max(spec.min, v)));
  };
  const range = spec.max - spec.min;
  return (
    <div className="fd-num">
      <label className="fd-num-row">
        <span className="fd-num-label">{spec.label}</span>
        <input type="range" min={spec.min} max={spec.max} step={spec.step} value={value} onChange={(e) => set(e.target.value)} />
        <input className="fd-num-box" type="number" min={spec.min} max={spec.max} step={spec.step} value={value} onChange={(e) => set(e.target.value)} />
        <span className="fd-num-suffix">{spec.suffix ?? ''}</span>
        <button
          type="button"
          className={motion ? 'fd-num-motion fd-num-motion--on' : 'fd-num-motion'}
          title={motion ? 'Stop moving' : 'Swing over the loop'}
          aria-pressed={motion !== undefined}
          onClick={() => onMotion(motion ? undefined : newMotion('wave', value, range))}
        >
          ~
        </button>
      </label>
      {motion?.kind === 'wave' && (
        <div className="fd-num-wave">
          <label>
            ± <input type="number" step={spec.step} value={motion.depth} onChange={(e) => onMotion({ ...motion, depth: Number(e.target.value) || 0 })} />
          </label>
          <label>
            cycles <input type="number" min={1} step={1} value={motion.cycles} onChange={(e) => onMotion({ ...motion, cycles: Math.max(1, Math.round(Number(e.target.value) || 1)) })} />
          </label>
        </div>
      )}
    </div>
  );
}
