import { type Design, selectBuds } from './design.js';
import { kindOf, paramsOf } from './kinds/index.js';
import { streamFor } from './random.js';
import { emptySkeleton, type Skeleton } from './skeleton.js';

export type StageResult =
  | { stage: string; skeleton: Skeleton; chosen: number }
  | { stage: string; error: Error }
  | { stage: string; unreached: true };

/** The skeleton after each stage, in order. A stage that throws carries its error, and every
 *  stage reading from it, directly or not, is unreached. */
export function growSteps(design: Design): StageResult[] {
  const out = new Map<string, Skeleton | null>();
  const results: StageResult[] = [];
  for (const stage of design.stages) {
    const sources = stage.input.from.map((id) => out.get(id));
    if (sources.some((s) => s === null || s === undefined)) {
      out.set(stage.id, null);
      results.push({ stage: stage.id, unreached: true });
      continue;
    }
    // One source for now; a graph will need a merge here.
    const input = (sources[0] as Skeleton | undefined) ?? emptySkeleton();
    try {
      const { chosen, rest } = selectBuds(input, stage.input.select);
      const nodes = [...input.nodes];
      const buds = kindOf(stage.kind).apply({
        stage,
        params: paramsOf(stage),
        buds: chosen,
        nodes,
        rng: streamFor(design.seed, stage.id),
      });
      const skeleton = { nodes, buds: [...rest, ...buds] };
      out.set(stage.id, skeleton);
      results.push({ stage: stage.id, skeleton, chosen: chosen.length });
    } catch (e) {
      out.set(stage.id, null);
      results.push({ stage: stage.id, error: e instanceof Error ? e : new Error(String(e)) });
    }
  }
  return results;
}

/** The finished skeleton: the last stage's. Throws the first stage error. */
export function grow(design: Design): Skeleton {
  const steps = growSteps(design);
  for (const s of steps) if ('error' in s) throw s.error;
  const last = steps.at(-1);
  return last && 'skeleton' in last ? last.skeleton : emptySkeleton();
}
