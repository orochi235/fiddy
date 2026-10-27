import type { EffectRun, EffectStageRun } from '@weasel-js/diagram/effect';
import type { Design, StageResult } from 'fiddy';
import { thumbnail } from '../tree/draw';

export const PREVIEW = { width: 120, height: 84 };

const count = (n: number, one: string) => `${n.toLocaleString('en-US')} ${one}${n === 1 ? '' : 's'}`;

/** What each stage did, for the diagram to draw on its box: the tree so far as a preview, its
 *  size, or its error. A stage after a failure has no entry, so it draws unreached. */
export function runOf(design: Design, steps: readonly StageResult[]): EffectRun {
  const stages: Record<string, EffectStageRun> = {};
  steps.forEach((r, i) => {
    if ('unreached' in r) return;
    if ('error' in r) {
      stages[r.stage] = { error: r.error.message };
      return;
    }
    const first = i === 0 || design.stages[i]?.kind === 'seed';
    const value = !first && r.chosen === 0 ? '0 buds' : `${count(r.skeleton.nodes.length, 'node')}`;
    stages[r.stage] = { values: { out: value }, previews: { out: thumbnail(r.skeleton, PREVIEW.width, PREVIEW.height, r.stage) } };
  });
  return { stages };
}

/** Frees a run's preview bitmaps once nothing draws them. */
export function closeRun(run: EffectRun) {
  for (const s of Object.values(run.stages)) for (const b of Object.values(s.previews ?? {})) b.close();
}
