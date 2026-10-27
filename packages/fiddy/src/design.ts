import { type Motion, sanitizeMotion } from './motion.js';
import type { Bud, Skeleton } from './skeleton.js';

export type ParamValue = number | string | boolean;

/** Which incoming buds a stage grows from. Heights are fractions of the skeleton's height so far. */
export interface Selector {
  minOrder?: number;
  maxOrder?: number;
  minHeight?: number;
  maxHeight?: number;
}

export interface StageInput {
  /** The stages whose output this one reads. A stack fills it with the stage before; a graph
   *  would wire it. */
  from: string[];
  select?: Selector;
}

export interface Stage {
  /** Stable: names the stage's random stream and the nodes it grows. */
  id: string;
  kind: string;
  params: Record<string, ParamValue>;
  /** A motion per number param, played over the design's loop. */
  motion?: Record<string, Motion>;
  input: StageInput;
}

export interface Timing {
  /** Seconds each stage takes to grow in playback. */
  grow: number;
  /** Seconds one loop of the design lasts: growth, then the finished tree, and every motion. */
  loop: number;
}

export const DEFAULT_TIMING: Timing = { grow: 1.5, loop: 8 };

export interface Design {
  seed: number;
  stages: Stage[];
  time?: Partial<Timing>;
}

export const timingOf = (d: Design): Timing => ({ ...DEFAULT_TIMING, ...d.time });

/** The stages rewired as a stack: each reads the one before it, the first reads nothing. */
export const restack = (stages: readonly Stage[]): Stage[] =>
  stages.map((s, i) => ({ ...s, input: { ...s.input, from: i === 0 ? [] : [stages[i - 1]!.id] } }));

/** The incoming buds split into those `select` chooses and the rest, which pass through open. */
export function selectBuds(skeleton: Skeleton, select: Selector | undefined): { chosen: Bud[]; rest: Bud[] } {
  if (!select) return { chosen: [...skeleton.buds], rest: [] };
  let lo = Infinity;
  let hi = -Infinity;
  for (const n of skeleton.nodes) {
    lo = Math.min(lo, n.pos[1]);
    hi = Math.max(hi, n.pos[1]);
  }
  const span = hi - lo;
  const height = (b: Bud) => (span > 0 ? (b.frame.pos[1] - lo) / span : 0);
  const chosen: Bud[] = [];
  const rest: Bud[] = [];
  for (const b of skeleton.buds) {
    const h = height(b);
    const ok =
      b.order >= (select.minOrder ?? -Infinity) &&
      b.order <= (select.maxOrder ?? Infinity) &&
      h >= (select.minHeight ?? -Infinity) &&
      h <= (select.maxHeight ?? Infinity);
    (ok ? chosen : rest).push(b);
  }
  return { chosen, rest };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function sanitizeSelector(v: unknown): Selector | undefined {
  if (!isRecord(v)) return undefined;
  const out: Selector = {};
  for (const k of ['minOrder', 'maxOrder', 'minHeight', 'maxHeight'] as const) if (finite(v[k])) out[k] = v[k];
  return Object.keys(out).length > 0 ? out : undefined;
}

function sanitizeStage(v: unknown): Stage | null {
  if (!isRecord(v) || typeof v.id !== 'string' || typeof v.kind !== 'string' || !isRecord(v.params)) return null;
  const params: Record<string, ParamValue> = {};
  for (const [k, p] of Object.entries(v.params)) {
    if (finite(p) || typeof p === 'string' || typeof p === 'boolean') params[k] = p;
  }
  const stage: Stage = { id: v.id, kind: v.kind, params, input: { from: [] } };
  if (isRecord(v.motion)) {
    const motion: Record<string, Motion> = {};
    for (const [k, m] of Object.entries(v.motion)) {
      const ok = sanitizeMotion(m);
      if (ok && finite(params[k])) motion[k] = ok;
    }
    if (Object.keys(motion).length > 0) stage.motion = motion;
  }
  const select = isRecord(v.input) ? sanitizeSelector(v.input.select) : undefined;
  if (select) stage.input.select = select;
  return stage;
}

/** A design from untrusted JSON, rewired as a stack, or `null` when nothing usable is there. */
export function sanitizeDesign(v: unknown): Design | null {
  if (!isRecord(v) || !Array.isArray(v.stages)) return null;
  const stages = v.stages.map(sanitizeStage).filter((s): s is Stage => s !== null);
  const ids = new Set<string>();
  const unique = stages.filter((s) => !ids.has(s.id) && ids.add(s.id));
  if (unique.length === 0) return null;
  const design: Design = { seed: finite(v.seed) ? Math.trunc(v.seed) : 1, stages: restack(unique) };
  if (isRecord(v.time)) {
    const time: Partial<Timing> = {};
    if (finite(v.time.grow) && v.time.grow > 0) time.grow = v.time.grow;
    if (finite(v.time.loop) && v.time.loop > 0) time.loop = v.time.loop;
    design.time = time;
  }
  return design;
}
