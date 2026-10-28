import type { ParamValue } from '../design.js';
import type { ParamSpec } from './types.js';

/** How a stage's nodes mature once formed (see `pose`). */
export interface Maturation {
  /** How long an internode takes to reach full length after the growth front reaches its tip, as a
   *  share of one stage's growth time. 0 draws each one whole as the front passes. */
  elongate: number;
  /** The pipe model's exponent, when the stage thickens by it: a node's radius to this power is the
   *  sum of what its grown children's are, never less than the radius it was made with. `null` keeps
   *  the radius it was made with. */
  pipe: number | null;
}

export const STILL: Maturation = { elongate: 0, pipe: null };

export const elongateParam: ParamSpec = { key: 'elongate', label: 'Elongation', type: 'number', default: 0.1, min: 0, max: 2, step: 0.01 };

export const pipeParam = (fallback: number): ParamSpec => ({ key: 'pipe', label: 'Pipe exponent', type: 'number', default: fallback, min: 1, max: 4, step: 0.05 });

/** `drawn` keeps the radii a kind draws with; `pipe` thickens them by the pipe model as the tree fills in. */
export const girthParam: ParamSpec = { key: 'girth', label: 'Girth', type: 'choice', default: 'drawn', options: ['drawn', 'pipe'] };

/** For a kind that always thickens by the pipe model. */
export const piped = (p: Record<string, ParamValue>): Maturation => ({ elongate: p.elongate as number, pipe: p.pipe as number });

/** For a kind whose `girth` param chooses. */
export const chosen = (p: Record<string, ParamValue>): Maturation => ({
  elongate: p.elongate as number,
  pipe: p.girth === 'pipe' ? (p.pipe as number) : null,
});
