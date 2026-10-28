import { interpret, type Module, type Polygon, type Skeleton, type TreeNode, UPRIGHT } from 'fiddy';

/** What a turtle draws for `modules` alone, from an upright root: a rule's successor, or one
 *  generation of a grammar. */
export function turtleSketch(modules: readonly Module[], deltaDegrees: number): Skeleton {
  const root: TreeNode = { id: 0, parent: null, pos: [0, 0, 0], radius: 1, order: 0, stage: 'sketch', born: 0 };
  const nodes: TreeNode[] = [root];
  const polygons: Polygon[] = [];
  interpret(modules, { node: 0, frame: UPRIGHT, order: 0, vigor: 1 }, nodes, polygons, {
    delta: (deltaDegrees * Math.PI) / 180,
    step: 1,
    width: 1,
    thin: 0.7,
    stage: 'sketch',
    cap: SKETCH_CAP,
  });
  return { nodes, buds: [], polygons };
}

/** Past this many modules a sketch is not drawn: it would cost a frame and show nothing a
 *  thumbnail can resolve. */
export const SKETCH_CAP = 40_000;
