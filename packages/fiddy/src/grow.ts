import { type Design, selectBuds } from './design.js';
import { kindOf, paramsOf } from './kinds/index.js';
import { pose } from './pose.js';
import { streamFor } from './random.js';
import { emptySkeleton, type Skeleton } from './skeleton.js';
import { spansOf } from './spans.js';

/** A stage's `skeleton` is the tree as it stands when the stage finishes growing, aged by `pose`;
 *  `raw` is the same tree grown at full size, which later stages grow from and `pose` reads. */
export type StageResult =
  | { stage: string; skeleton: Skeleton; raw: Skeleton; chosen: number }
  | { stage: string; error: Error }
  | { stage: string; unreached: true };

/** The skeleton after each stage, in order. A stage that throws carries its error, and every
 *  stage reading from it, directly or not, is unreached. */
export function growSteps(design: Design): StageResult[] {
  const out = new Map<string, Skeleton | null>();
  const results: StageResult[] = [];
  const ends = new Map(spansOf(design).map((s) => [s.stage, s.end]));
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
      const kind = kindOf(stage.kind);
      const { chosen, rest } = kind.whole ? { chosen: [...input.buds], rest: [] } : selectBuds(input, stage.input.select);
      const nodes = [...input.nodes];
      const polygons = [...input.polygons];
      const buds = kind.apply({
        stage,
        params: paramsOf(stage),
        buds: chosen,
        nodes,
        polygons,
        rng: streamFor(design.seed, stage.id),
        clock: design.clock ?? 0,
      });
      const raw = { nodes, buds: [...rest, ...buds], polygons };
      out.set(stage.id, raw);
      results.push({ stage: stage.id, skeleton: pose(raw, design, ends.get(stage.id)!), raw, chosen: chosen.length });
    } catch (e) {
      out.set(stage.id, null);
      results.push({ stage: stage.id, error: e instanceof Error ? e : new Error(String(e)) });
    }
  }
  return results;
}

/** The finished tree: the last stage's, aged to the end of growth. Throws the first stage error. */
export function grow(design: Design): Skeleton {
  const steps = growSteps(design);
  for (const s of steps) if ('error' in s) throw s.error;
  const last = steps.at(-1);
  return last && 'skeleton' in last ? last.skeleton : emptySkeleton();
}
