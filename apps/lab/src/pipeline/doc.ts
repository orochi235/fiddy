import { type EffectDoc, type EffectParam, type EffectStage, mainChain } from '@weasel-js/diagram/effect';
import { type Design, KINDS, paramsOf, type Selector, type Stage } from 'fiddy';

/** The one value type on the pipeline: a skeleton and its open buds. */
export const TREE = 'tree';

const num = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, ''));

export function selectorText(sel: Selector | undefined): string | null {
  if (!sel) return null;
  const parts: string[] = [];
  if (sel.minOrder !== undefined || sel.maxOrder !== undefined) {
    if (sel.minOrder !== undefined && sel.minOrder === sel.maxOrder) parts.push(`order = ${sel.minOrder}`);
    else {
      if (sel.minOrder !== undefined) parts.push(`order ≥ ${sel.minOrder}`);
      if (sel.maxOrder !== undefined) parts.push(`order ≤ ${sel.maxOrder}`);
    }
  }
  if (sel.minHeight !== undefined) parts.push(`height ≥ ${num(sel.minHeight)}`);
  if (sel.maxHeight !== undefined) parts.push(`height ≤ ${num(sel.maxHeight)}`);
  return parts.length > 0 ? parts.join(', ') : null;
}

/** What a stage's box lists: its short number params, `~` marking one that moves, and its selector. */
function shownParams(stage: Stage): EffectParam[] {
  const kind = KINDS[stage.kind];
  if (!kind) return [];
  const values = paramsOf(stage);
  const out: EffectParam[] = [];
  const show = stage.kind === 'lsystem' ? ['n', 'delta'] : kind.params.filter((p) => p.type === 'number').map((p) => p.key);
  for (const key of show) {
    const spec = kind.params.find((p) => p.key === key);
    if (!spec || spec.type !== 'number') continue;
    const moving = stage.motion?.[key] ? ' ~' : '';
    out.push({ id: key, label: spec.label, value: `${num(values[key] as number)}${spec.suffix ?? ''}${moving}` });
  }
  const sel = selectorText(stage.input.select);
  if (sel) out.push({ id: 'select', label: 'buds', value: sel });
  return out;
}

/** The design as a pipeline the diagram draws: one stage per stage, wired in stack order. */
export function designDoc(design: Design): EffectDoc {
  const stages: EffectStage[] = design.stages.map((s, i) => ({
    id: s.id,
    title: KINDS[s.kind]?.title ?? s.kind,
    type: s.kind,
    kind: s.kind === 'seed' && i === 0 ? 'source' : 'stage',
    inputs: i === 0 ? [] : [{ id: 'in', type: TREE }],
    outputs: [{ id: 'out', type: TREE }],
    params: shownParams(s),
  }));
  const wires = design.stages.slice(1).map((s, i) => ({
    id: `${design.stages[i]!.id}>${s.id}`,
    from: { stage: design.stages[i]!.id, port: 'out' },
    to: { stage: s.id, port: 'in' },
  }));
  return { pipeline: { stages, wires }, places: {} };
}

/** The stages in the order an edit to the diagram leaves them, or `null` when it changed
 *  nothing the design holds. A deletion keeps the survivors in their order; a reorder rewires
 *  the chain, which is read back along its wires. */
export function stagesAfter(next: EffectDoc, design: Design): Stage[] | null {
  const byId = new Map(design.stages.map((s) => [s.id, s]));
  const kept = next.pipeline.stages.map((s) => byId.get(s.id)).filter((s): s is Stage => s !== undefined);
  if (kept.length < design.stages.length) return kept;
  const chain = mainChain(next.pipeline);
  if (chain.length !== design.stages.length) return null;
  const order = chain.map((id) => byId.get(id)!);
  return order.every((s, i) => s === design.stages[i]) ? null : order;
}
