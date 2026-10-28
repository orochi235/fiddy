import { type Design, type Stage, timingOf } from './design.js';
import { KINDS, paramsOf } from './kinds/index.js';
import { type Maturation, STILL } from './kinds/maturation.js';
import type { Bud, Polygon, Skeleton, TreeNode } from './skeleton.js';
import { type Span, spansOf } from './spans.js';
import { add, scale, sub, type Vec3 } from './vec.js';

/** What paces the growth front through a stage's nodes: `born`, or, where every node of the stage
 *  has one, the `module` that drew it (the turtle's own order). */
export type Pace = 'born' | 'module';

const maturationOf = (s: Stage): Maturation => (KINDS[s.kind]?.mature?.(paramsOf(s)) ?? STILL);

/** The last index in sorted `xs` holding `x`. */
function lastIndex(xs: readonly number[], x: number): number {
  let lo = 0;
  let hi = xs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid]! <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

/** When the growth front reaches each node, in seconds: through each stage's span at an even count
 *  of nodes per second, in pace order, so a tree whose tips lie far out does not stand as a bare
 *  stalk for most of its growth. Tied nodes, such as one iteration's, form together once the front has
 *  passed them all; their internodes grow toward that from when their parents formed. */
function formationOf(nodes: readonly TreeNode[], spans: readonly Span[], pace: Pace): Float64Array {
  const byStage = new Map<string, number[]>();
  nodes.forEach((n, i) => {
    const ids = byStage.get(n.stage);
    if (ids) ids.push(i);
    else byStage.set(n.stage, [i]);
  });
  const spanOf = new Map(spans.map((s) => [s.stage, s]));
  const out = new Float64Array(nodes.length);
  for (const [stage, ids] of byStage) {
    const span = spanOf.get(stage);
    if (!span) continue;
    const byModule = pace === 'module' && ids.every((i) => nodes[i]!.module !== undefined);
    const key = (i: number) => (byModule ? nodes[i]!.module! : nodes[i]!.born);
    const keys = ids.map(key).sort((a, b) => a - b);
    const last = Math.max(1, keys.length - 1);
    for (const i of ids) out[i] = span.start + ((span.end - span.start) * lastIndex(keys, key(i))) / last;
  }
  return out;
}

const formationCache = new WeakMap<readonly TreeNode[], Map<string, Float64Array>>();
function formation(nodes: readonly TreeNode[], spans: readonly Span[], pace: Pace): Float64Array {
  const key = `${pace} ${spans.map((s) => `${s.stage}:${s.start}:${s.end}`).join(' ')}`;
  let byKey = formationCache.get(nodes);
  if (!byKey) formationCache.set(nodes, (byKey = new Map()));
  let f = byKey.get(key);
  if (!f) byKey.set(key, (f = formationOf(nodes, spans, pace)));
  return f;
}

/**
 * The tree as it stands `seconds` into growth (see `spansOf`), from the skeleton its stages grew at
 * full size: only the nodes the growth front has reached, ids renumbered, each aged by its stage's
 * `Maturation`. An internode starts when the front reaches its parent (or its stage starts) and
 * reaches full length `elongate` of a stage's time after the front reaches it, carrying everything
 * beyond it along. A stage thickening by the pipe model sums what each node carries now, so a branch
 * thickens as its crown fills in. Polygons grow with their node's internode; buds move with their
 * node. Past the end of growth the tree stands as it was at the end.
 */
export function pose(raw: Skeleton, design: Design, seconds: number, pace: Pace = 'born'): Skeleton {
  const spans = spansOf(design);
  const end = spans.at(-1)?.end ?? 0;
  const t = Math.min(seconds, end);
  const { grow } = timingOf(design);
  const formed = formation(raw.nodes, spans, pace);
  const startOf = new Map(spans.map((s) => [s.stage, s.start]));
  const how = new Map(design.stages.map((s) => [s.id, maturationOf(s)]));
  const { nodes } = raw;
  const n = nodes.length;

  // How much of each node's internode has grown, 0–1; -1 for a node not yet reached.
  const k = new Float64Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const node = nodes[i]!;
    const p = node.parent;
    if (p === null) {
      if (t >= formed[i]!) k[i] = 1;
      continue;
    }
    if (k[p]! < 0) continue;
    const s = Math.max(formed[p]!, startOf.get(node.stage) ?? 0);
    const span = formed[i]! - s + (how.get(node.stage) ?? STILL).elongate * grow;
    const g = span > 0 ? (t - s) / span : t > s || t >= end ? 1 : 0;
    if (g > 0 || t >= end) k[i] = Math.min(1, Math.max(0, g));
  }

  const radius = new Float64Array(n);
  const carried = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    if (k[i]! < 0) continue;
    const node = nodes[i]!;
    const pipe = how.get(node.stage)?.pipe ?? null;
    radius[i] = pipe === null ? node.radius : Math.max(node.radius, carried[i]! ** (1 / pipe));
    const p = node.parent;
    const up = p === null ? null : (how.get(nodes[p]!.stage)?.pipe ?? null);
    if (up !== null) carried[p!]! += radius[i]! ** up;
  }

  const ids = new Int32Array(n).fill(-1);
  const pos: Vec3[] = new Array(n);
  const out: TreeNode[] = [];
  for (let i = 0; i < n; i++) {
    if (k[i]! < 0) continue;
    const node = nodes[i]!;
    const p = node.parent;
    pos[i] = p === null ? node.pos : add(pos[p]!, scale(sub(node.pos, nodes[p]!.pos), k[i]!));
    ids[i] = out.length;
    out.push({ ...node, id: out.length, parent: p === null ? null : ids[p]!, pos: pos[i]!, radius: radius[i]! });
  }

  const buds: Bud[] = raw.buds
    .filter((b) => ids[b.node]! >= 0)
    .map((b) => ({ ...b, node: ids[b.node]!, frame: { ...b.frame, pos: pos[b.node]! } }));
  const polygons: Polygon[] = raw.polygons
    .filter((g) => ids[g.node]! >= 0)
    .map((g) => {
      const at = nodes[g.node]!.pos;
      const to = pos[g.node]!;
      const grown = k[g.node]!;
      return { ...g, node: ids[g.node]!, points: g.points.map((q) => add(to, scale(sub(q, at), grown))) };
    });
  return { nodes: out, buds, polygons };
}
