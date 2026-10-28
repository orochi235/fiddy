import type { Animator, Design } from 'fiddy';
import { Select } from '@weasel-js/ui';
import type { RevealMode } from '../tree/draw';
import { Score } from './Score';
import './Transport.css';

interface Props {
  design: Design;
  animator: Animator;
  t: number;
  playing: boolean;
  reveal: RevealMode;
  onPlay: (playing: boolean) => void;
  onSeek: (t: number) => void;
  onReveal: (mode: RevealMode) => void;
}

const REVEALS = [
  { value: 'grow', label: 'grow outward' },
  { value: 'turtle', label: 'turtle order' },
] as const;

/** Play and scrub the design's loop, with its score drawn underneath. */
export function Transport({ design, animator, t, playing, reveal, onPlay, onSeek, onReveal }: Props) {
  return (
    <div className="fd-transport">
      <div className="fd-transport-row">
        <button type="button" className="fd-transport-play" onClick={() => onPlay(!playing)} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? '❚❚' : '▶'}
        </button>
        <Select<RevealMode> aria-label="Reveal" width="fit" selectedKey={reveal} onSelectionChange={onReveal} options={REVEALS} />
        <input className="fd-transport-scrub" type="range" min={0} max={animator.loop} step={0.01} value={t} onChange={(e) => onSeek(Number(e.target.value))} aria-label="Time" />
        <span className="fd-transport-time">
          {t.toFixed(2)} / {animator.loop.toFixed(2)} s
        </span>
      </div>
      <Score design={design} animator={animator} t={t} onSeek={onSeek} />
    </div>
  );
}
