import { animate, emptySkeleton, growSteps } from 'fiddy';
import { useEffect, useMemo, useState } from 'react';
import { initialState } from '../state';
import { lastGrown, treeAt } from '../tree/shown';
import { TreeView } from '../tree/TreeView';

/** Playback runs at this share of real time, so a tile's tree grows slowly enough to watch. */
const PACE = 0.35;
/** Seconds a still design's finished tree stands before it grows again. */
const HOLD = 2.5;

const ignore = () => {};

/** The chromeless view embeds use: the hash's tree, growing on a loop, or finished when `still`. */
export function Bare({ still }: { still: boolean }) {
  const [{ design }] = useState(initialState);
  const animator = useMemo(() => animate(design), [design]);
  const steps = useMemo(() => growSteps(design), [design]);
  const [t, setT] = useState(() => (still ? (animator.spans.at(-1)?.end ?? 0) : 0));

  useEffect(() => {
    if (still) return;
    const cycle = animator.moving ? animator.loop : animator.loop + HOLD;
    const start = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      setT((((now - start) / 1000) * PACE) % cycle);
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [still, animator]);

  const moment = useMemo(() => animator.at(Math.min(t, animator.loop)), [animator, t]);
  const { skeleton } = useMemo(() => treeAt(animator, steps, moment, 'grow'), [animator, steps, moment]);
  const finished = lastGrown(steps)?.skeleton ?? emptySkeleton();
  return <TreeView skeleton={skeleton ?? emptySkeleton()} fitTo={finished} selected={null} hover={null} onHover={ignore} />;
}
