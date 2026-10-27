import { animate, growSteps, PRESETS, type Skeleton, type Stage, type StageResult } from 'fiddy';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Inspector } from './inspector/Inspector';
import { Pipeline } from './pipeline/Pipeline';
import { editStage, useFiddy, withStages } from './session';
import { presetState, writeHash } from './state';
import { Transport } from './transport/Transport';
import type { Hover, RevealMode } from './tree/draw';
import { TreeView } from './tree/TreeView';
import './Workspace.css';

const lastSkeleton = (steps: readonly StageResult[]): Skeleton | null => {
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i]!;
    if ('skeleton' in s) return s.skeleton;
  }
  return null;
};

function freshId(stages: readonly Stage[], kind: string): string {
  const ids = new Set(stages.map((s) => s.id));
  for (let k = 1; ; k++) if (!ids.has(`${kind}-${k}`)) return `${kind}-${k}`;
}

/** Layout B: the pipeline down the left, the tree in the middle, the selected stage's inspector
 *  on the right, and the transport along the bottom. */
export function Workspace() {
  const { state, setState } = useFiddy();
  const { design } = state;
  const [selected, setSelected] = useState<string | null>(() => design.stages.at(-1)?.id ?? null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [reveal, setReveal] = useState<RevealMode>('grow');
  const [playing, setPlaying] = useState(false);

  const animator = useMemo(() => animate(design), [design]);
  const grownBy = (a: typeof animator) => a.spans.at(-1)?.end ?? 0;
  const [t, setT] = useState(() => grownBy(animator));

  // A playhead resting on the finished tree stays on it when an edit moves where growth ends.
  const previous = useRef(animator);
  useEffect(() => {
    const before = grownBy(previous.current);
    previous.current = animator;
    if (!playing) setT((v) => (v >= before - 1e-6 ? grownBy(animator) : Math.min(v, animator.loop)));
  }, [animator]);

  useEffect(() => writeHash(state), [state]);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      const dt = (now - last) / 1000;
      last = now;
      setT((v) => (v + dt) % animator.loop);
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [playing, animator]);

  const moment = useMemo(() => animator.at(Math.min(t, animator.loop)), [animator, t]);
  const steps = useMemo(() => growSteps(design), [design]);
  // A moving param regrows the tree each frame; a still design reuses the steps the pipeline drew.
  const shownSteps = useMemo(() => (animator.moving ? growSteps(moment.design) : steps), [animator, moment, steps]);

  const failed = shownSteps.some((s) => 'error' in s);
  const good = useRef<Skeleton | null>(null);
  const current = failed ? null : lastSkeleton(shownSteps);
  if (current) good.current = current;
  const skeleton = current ?? good.current ?? { nodes: [], buds: [] };
  const finished = lastSkeleton(steps) ?? skeleton;
  const treeReveal = useMemo(() => ({ grown: moment.grown, mode: reveal }), [moment.grown, reveal]);

  const stage = design.stages.find((s) => s.id === selected) ?? design.stages.at(-1) ?? null;

  const addAfter = (kind: string) => {
    const at = stage ? design.stages.indexOf(stage) + 1 : design.stages.length;
    const id = freshId(design.stages, kind);
    const next = [...design.stages];
    next.splice(at, 0, { id, kind, params: {}, input: { from: [] } });
    setState((s) => withStages(s, next));
    setSelected(id);
  };

  const remove = () => {
    if (!stage || design.stages.length <= 1) return;
    setState((s) => withStages(s, s.design.stages.filter((x) => x.id !== stage.id)));
    setSelected(design.stages.find((x) => x.id !== stage.id)?.id ?? null);
  };

  return (
    <div className="fd-workspace">
      <div className="fd-workspace-pipe">
        <label className="fd-preset">
          <span>Preset</span>
          <select value={state.preset} onChange={(e) => setState(presetState(e.target.value))}>
            {state.preset === '' && <option value="">(edited)</option>}
            {PRESETS.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <Pipeline
          design={design}
          steps={steps}
          selected={stage?.id ?? null}
          onSelect={setSelected}
          onStages={(stages) => setState((s) => withStages(s, stages))}
        />
      </div>
      <div className="fd-workspace-tree">
        <TreeView skeleton={skeleton} fitTo={finished} reveal={treeReveal} selected={stage?.id ?? null} hover={hover} onHover={setHover} dimmed={failed} />
      </div>
      <div className="fd-workspace-inspector">
        <Inspector
          stage={stage}
          seed={design.seed}
          hover={hover}
          onHover={setHover}
          onStage={(next) => setState((s) => editStage(s, next.id, () => next))}
          onAdd={addAfter}
          onRemove={remove}
        />
      </div>
      <div className="fd-workspace-time">
        <Transport
          design={design}
          animator={animator}
          t={Math.min(t, animator.loop)}
          playing={playing}
          reveal={reveal}
          onPlay={setPlaying}
          onSeek={(v) => {
            setPlaying(false);
            setT(v);
          }}
          onReveal={setReveal}
        />
      </div>
    </div>
  );
}
