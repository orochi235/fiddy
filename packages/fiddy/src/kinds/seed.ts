import { UPRIGHT } from '../frame.js';
import type { StageKind } from './types.js';

/** A root node on the ground with one bud pointing up. Buds it is given pass on untouched. */
export const seed: StageKind = {
  kind: 'seed',
  title: 'Seed',
  instant: true,
  params: [
    { key: 'x', label: 'x', type: 'number', default: 0, min: -100, max: 100, step: 0.1 },
    { key: 'width', label: 'Width', type: 'number', default: 1, min: 0.01, max: 10, step: 0.01 },
  ],
  apply({ stage, params, buds, nodes }) {
    const id = nodes.length;
    const pos = [params.x as number, 0, 0] as const;
    nodes.push({ id, parent: null, pos, radius: params.width as number, order: 0, stage: stage.id, born: 0 });
    return [...buds, { node: id, frame: { ...UPRIGHT, pos }, order: 0, vigor: 1 }];
  },
};
