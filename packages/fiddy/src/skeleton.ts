import type { Frame } from './frame.js';
import { hashString } from './random.js';
import type { Vec3 } from './vec.js';

/** One point of a branch. A node with a parent draws the segment from its parent to itself;
 *  a node with none starts a new branch line. */
export interface TreeNode {
  id: number;
  parent: number | null;
  pos: Vec3;
  radius: number;
  /** Branch order: 0 for the axis a stage starts on, one more inside each `[`. */
  order: number;
  /** The id of the stage that grew it. */
  stage: string;
  /** When it grows, in the stage's own units: arc length from where the stage began. */
  born: number;
  /** For an L-system stage, the index of the module that drew it. */
  module?: number;
}

/** An open growing tip a later stage can grow from. */
export interface Bud {
  node: number;
  frame: Frame;
  order: number;
  vigor: number;
}

export interface Skeleton {
  nodes: readonly TreeNode[];
  buds: readonly Bud[];
}

export const emptySkeleton = (): Skeleton => ({ nodes: [], buds: [] });

/** A short fingerprint of a skeleton's nodes, coordinates rounded to a millionth so that
 *  floating-point noise below that does not count as a change. */
export function skeletonHash(s: Skeleton): string {
  const round = (_key: string, v: unknown) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v);
  return hashString(JSON.stringify(s.nodes, round)).toString(16).padStart(8, '0');
}
