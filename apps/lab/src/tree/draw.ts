import type { Skeleton, TreeNode } from 'fiddy';
import { ACCENT, DIM, HOVER, INK, LEAF } from '../colors';

/** What paces growth playback: arc length (`born`), or the turtle's module order. */
export type RevealMode = 'grow' | 'turtle';

export interface Hover {
  stage: string;
  module: number;
  /** Which bud's string `module` indexes, for a stochastic stage; absent when buds share one. */
  bud?: number;
}

/** Line width per world unit of radius: the 2D view draws a branch this many times its radius
 *  wide, and the 3D view builds its tubes at half of it, so the two agree. */
export const WEIGHT = 0.12;

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

export interface DrawOptions {
  width: number;
  height: number;
  pad?: number;
  /** Fit to these nodes rather than the ones drawn, so a tree growing in place does not rescale. */
  fitTo?: readonly TreeNode[];
  selected?: string | null;
  hover?: Hover | null;
  /** Screen pixels of line per world unit of radius, at the fit's scale. */
  weight?: number;
}

/** Draws the skeleton's segments and polygons into a context already sized to `width` × `height` in its
 *  own units, and returns the fit it used. */
export function drawSkeleton(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, s: Skeleton, o: DrawOptions): Fit {
  const fit = fitOf(o.fitTo ?? s.nodes, o.width, o.height, o.pad ?? 12);
  const weight = o.weight ?? WEIGHT;
  ctx.lineCap = 'round';
  for (const n of s.nodes) {
    if (n.parent === null) continue;
    const p = s.nodes[n.parent]!;
    const hot = o.hover && n.stage === o.hover.stage && n.module === o.hover.module && n.bud === o.hover.bud;
    ctx.strokeStyle = hot ? HOVER : o.selected == null ? INK : n.stage === o.selected ? ACCENT : DIM;
    ctx.lineWidth = hot ? Math.max(3, n.radius * fit.scale * weight) : Math.min(14, Math.max(0.5, n.radius * fit.scale * weight));
    ctx.beginPath();
    ctx.moveTo(p.pos[0] * fit.scale + fit.ox, fit.oy - p.pos[1] * fit.scale);
    ctx.lineTo(n.pos[0] * fit.scale + fit.ox, fit.oy - n.pos[1] * fit.scale);
    ctx.stroke();
  }
  for (const g of s.polygons) {
    const hot = o.hover && g.stage === o.hover.stage && g.module === o.hover.module && g.bud === o.hover.bud;
    ctx.fillStyle = hot ? HOVER : o.selected == null ? LEAF : g.stage === o.selected ? ACCENT : DIM;
    ctx.beginPath();
    for (const p of g.points) ctx.lineTo(p[0] * fit.scale + fit.ox, fit.oy - p[1] * fit.scale);
    ctx.fill();
  }
  return fit;
}

/** The node nearest screen point (`x`, `y`) within `radius` pixels, if any. */
export function pick(s: Skeleton, fit: Fit, x: number, y: number, radius: number): TreeNode | null {
  let best: TreeNode | null = null;
  let bestD = radius * radius;
  for (const n of s.nodes) {
    const dx = n.pos[0] * fit.scale + fit.ox - x;
    const dy = fit.oy - n.pos[1] * fit.scale - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
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
