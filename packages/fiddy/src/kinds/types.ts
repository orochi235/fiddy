import type { ParamValue, Stage } from '../design.js';
import type { Rng } from '../random.js';
import type { Bud, TreeNode } from '../skeleton.js';

export type ParamSpec =
  | {
      key: string;
      label: string;
      type: 'number';
      default: number;
      min: number;
      max: number;
      step: number;
      suffix?: string;
    }
  | { key: string; label: string; type: 'text'; default: string }
  | { key: string; label: string; type: 'choice'; default: string; options: readonly string[] };

export interface StageContext {
  stage: Stage;
  /** Every param, defaults filled in. */
  params: Record<string, ParamValue>;
  /** The incoming buds the stage's selector chose. */
  buds: readonly Bud[];
  /** The incoming nodes, which the stage appends to; new ids continue from its length. */
  nodes: TreeNode[];
  rng: Rng;
  /** Where in its loop the design is posed, 0–1: the design's `clock`, or 0 without one. */
  clock: number;
}

/** One kind of stage: its params as data, which a UI builds its fields from, and what it does.
 *  `apply` returns the open buds it leaves, which may include ones it was given; incoming buds
 *  the selector did not choose pass through without it. */
export interface StageKind {
  kind: string;
  title: string;
  params: readonly ParamSpec[];
  /** Takes no time in growth playback. */
  instant?: boolean;
  /** Changes with the loop's clock, so a design holding one moves in playback. */
  clocked?: boolean;
  /** Works on the whole incoming tree: the selector is ignored and every bud is passed in. */
  whole?: boolean;
  apply(ctx: StageContext): Bud[];
}
