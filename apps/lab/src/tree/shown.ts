import { type Animator, growSteps, type Moment, pose, type Skeleton, type StageResult } from 'fiddy';
import type { RevealMode } from './draw';

export const lastGrown = (steps: readonly StageResult[]): Extract<StageResult, { raw: Skeleton }> | null => {
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i]!;
    if ('raw' in s) return s;
  }
  return null;
};

/** The tree as playback shows it at `moment`: regrown when a param moves, else from `steps`, then
 *  aged to the moment. `skeleton` is null when a stage failed. */
export function treeAt(animator: Animator, steps: readonly StageResult[], moment: Moment, reveal: RevealMode): { skeleton: Skeleton | null; failed: boolean } {
  const shown = animator.moving ? growSteps(moment.design) : steps;
  const failed = shown.some((s) => 'error' in s);
  const grown = failed ? null : lastGrown(shown);
  const skeleton = grown ? pose(grown.raw, moment.design, moment.time, reveal === 'turtle' ? 'module' : 'born') : null;
  return { skeleton, failed };
}
