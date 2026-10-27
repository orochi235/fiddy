import type { Skeleton, TreeNode } from 'fiddy';
import { ACCENT, DIM, HOVER, INK } from '../colors';

export type RevealMode = 'grow' | 'turtle';

/** How much of each stage shows: `grown` 0–1 per stage, read along arc length or turtle order. */
export interface Reveal {
  grown: Readonly<Record<string, number>>;
  mode: RevealMode;
}

export interface Hover {
  stage: string;
  module: number;
}

/** World to screen: `x * scale + ox`, `oy - y * scale` (world y points up). */
export interface Fit {
  scale: number;
  ox: number;
  oy: number;
}

export function fitOf(nodes: readonly TreeNode[], width: number, height: number, pad: number): Fit {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const n of nodes) {
    x0 = Math.min(x0, n.pos[0]); x1 = Math.max(x1, n.pos[0]);
    y0 = Math.min(y0, n.pos[1]); y1 = Math.max(y1, n.pos[1]);
  }
  if (!Number.isFinite(x0)) return { scale: 1, ox: width / 2, oy: height / 2 };
  const scale = Math.min((width - 2 * pad) / Math.max(x1 - x0, 1e-6), (height - 2 * pad) / Math.max(y1 - y0, 1e-6));
  return { scale, ox: width / 2 - ((x0 + x1) / 2) * scale, oy: height / 2 + ((y0 + y1) / 2) * scale };
}

/** Per stage, the furthest `born` and the last `module` any node reached. */
function extentsOf(nodes: readonly TreeNode[]) {
  const out = new Map<string, { born: number; module: number }>();
  for (const n of nodes) {
    const e = out.get(n.stage) ?? { born: 0, module: 0 };
    e.born = Math.max(e.born, n.born);
    e.module = Math.max(e.module, n.module ?? 0);
    out.set(n.stage, e);
  }
  return out;
}

const extentCache = new WeakMap<readonly TreeNode[], ReturnType<typeof extentsOf>>();
function extents(nodes: readonly TreeNode[]) {
  let e = extentCache.get(nodes);
  if (!e) extentCache.set(nodes, (e = extentsOf(nodes)));
  return e;
}

/** How much of `n` shows: 1 whole, 0 not at all, between for a segment partway grown. */
export function shown(n: TreeNode, parent: TreeNode | undefined, reveal: Reveal | undefined, ext: ReturnType<typeof extentsOf>): number {
  if (!reveal) return 1;
  const g = reveal.grown[n.stage] ?? 1;
  if (g >= 1) return 1;
  if (g <= 0) return 0;
  const e = ext.get(n.stage)!;
  if (reveal.mode === 'turtle') return (n.module ?? 0) <= g * e.module ? 1 : 0;
  const front = g * e.born;
  if (n.born <= front) return 1;
  const from = parent && parent.stage === n.stage ? parent.born : 0;
  return front > from ? (front - from) / (n.born - from) : 0;
}

export interface DrawOptions {
  width: number;
  height: number;
  pad?: number;
  /** Fit to these nodes rather than the ones drawn, so a tree growing in place does not rescale. */
  fitTo?: readonly TreeNode[];
  reveal?: Reveal;
  selected?: string | null;
  hover?: Hover | null;
  /** Screen pixels of line per world unit of radius, at the fit's scale. */
  weight?: number;
}

/** Draws the skeleton's segments into a context already sized to `width` × `height` in its
 *  own units, and returns the fit it used. */
export function drawSkeleton(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, s: Skeleton, o: DrawOptions): Fit {
  const fit = fitOf(o.fitTo ?? s.nodes, o.width, o.height, o.pad ?? 12);
  const ext = extents(s.nodes);
  const weight = o.weight ?? 0.12;
  ctx.lineCap = 'round';
  for (const n of s.nodes) {
    if (n.parent === null) continue;
    const p = s.nodes[n.parent]!;
    const k = shown(n, p, o.reveal, ext);
    if (k <= 0) continue;
    const x = p.pos[0] + (n.pos[0] - p.pos[0]) * k;
    const y = p.pos[1] + (n.pos[1] - p.pos[1]) * k;
    const hot = o.hover && n.stage === o.hover.stage && n.module === o.hover.module;
    ctx.strokeStyle = hot ? HOVER : o.selected == null ? INK : n.stage === o.selected ? ACCENT : DIM;
    ctx.lineWidth = hot ? Math.max(3, n.radius * fit.scale * weight) : Math.min(14, Math.max(0.5, n.radius * fit.scale * weight));
    ctx.beginPath();
    ctx.moveTo(p.pos[0] * fit.scale + fit.ox, fit.oy - p.pos[1] * fit.scale);
    ctx.lineTo(x * fit.scale + fit.ox, fit.oy - y * fit.scale);
    ctx.stroke();
  }
  return fit;
}

/** The shown node nearest screen point (`x`, `y`) within `radius` pixels, if any. */
export function pick(s: Skeleton, fit: Fit, x: number, y: number, radius: number, reveal?: Reveal): TreeNode | null {
  const ext = extents(s.nodes);
  let best: TreeNode | null = null;
  let bestD = radius * radius;
  for (const n of s.nodes) {
    const dx = n.pos[0] * fit.scale + fit.ox - x;
    const dy = fit.oy - n.pos[1] * fit.scale - y;
    const d = dx * dx + dy * dy;
    if (d < bestD && shown(n, n.parent === null ? undefined : s.nodes[n.parent], reveal, ext) >= 1) {
      best = n;
      bestD = d;
    }
  }
  return best;
}

/** A small picture of `s`, for a preview slot or a thumbnail. */
export function thumbnail(s: Skeleton, width: number, height: number, selected?: string | null): ImageBitmap {
  const canvas = new OffscreenCanvas(width * 2, height * 2);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);
  drawSkeleton(ctx, s, { width, height, pad: 4, selected: selected ?? null, weight: 0.06 });
  return canvas.transferToImageBitmap();
}
