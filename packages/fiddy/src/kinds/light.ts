import { growLight } from '../light/sim.js';
import type { StageKind } from './types.js';

const RAD = Math.PI / 180;

/** Palubicki et al.'s self-organizing trees: every selected bud grows a tree, cycle by cycle, and
 *  all of them compete for light through one shadow grid. */
export const light: StageKind = {
  kind: 'light',
  title: 'Light competition',
  brief: ['cycles', 'lambda', 'shadow'],
  params: [
    { key: 'cycles', label: 'Cycles', type: 'number', default: 12, min: 1, max: 30, step: 1 },
    { key: 'lambda', label: 'λ (apical)', type: 'number', default: 0.62, min: 0, max: 1, step: 0.01 },
    { key: 'vigor', label: 'Vigor', type: 'number', default: 3, min: 0.5, max: 6, step: 0.1 },
    { key: 'burst', label: 'Metamers / cycle', type: 'number', default: 3, min: 1, max: 10, step: 1 },
    { key: 'shadow', label: 'Shadow', type: 'number', default: 0.08, min: 0, max: 1, step: 0.01 },
    { key: 'depth', label: 'Shadow depth', type: 'number', default: 4, min: 1, max: 12, step: 1 },
    { key: 'light', label: 'Toward light', type: 'number', default: 0.3, min: 0, max: 3, step: 0.01 },
    { key: 'up', label: 'Toward sky', type: 'number', default: 0.1, min: -1, max: 2, step: 0.01 },
    { key: 'gravity', label: 'Gravity', type: 'number', default: 0.05, min: 0, max: 2, step: 0.01 },
    { key: 'wander', label: 'Wander', type: 'number', default: 0.1, min: 0, max: 2, step: 0.01 },
    { key: 'angle', label: 'Branch angle', type: 'number', default: 40, min: 0, max: 90, step: 0.5, suffix: '°' },
    { key: 'divergence', label: 'Divergence', type: 'number', default: 137.5, min: 0, max: 180, step: 0.5, suffix: '°' },
    { key: 'length', label: 'Metamer length', type: 'number', default: 1, min: 0.05, max: 10, step: 0.05 },
    { key: 'shed', label: 'Shed below', type: 'number', default: 0, min: 0, max: 1, step: 0.01 },
    { key: 'width', label: 'Tip width', type: 'number', default: 0.15, min: 0.01, max: 2, step: 0.01 },
    { key: 'pipe', label: 'Pipe exponent', type: 'number', default: 2.5, min: 1, max: 4, step: 0.05 },
    { key: 'cap', label: 'Node cap', type: 'number', default: 4000, min: 100, max: 50_000, step: 100 },
  ],
  apply({ stage, params, buds, nodes, rng }) {
    const n = (k: string) => params[k] as number;
    return growLight(buds, nodes, rng, {
      stage: stage.id,
      cycles: Math.max(0, Math.round(n('cycles'))),
      lambda: n('lambda'),
      vigor: n('vigor'),
      burst: Math.max(1, Math.round(n('burst'))),
      shadow: n('shadow'),
      depth: Math.max(0, Math.round(n('depth'))),
      light: n('light'),
      up: n('up'),
      gravity: n('gravity'),
      wander: n('wander'),
      angle: n('angle') * RAD,
      divergence: n('divergence') * RAD,
      length: n('length'),
      shed: n('shed'),
      width: n('width'),
      pipe: n('pipe'),
      cap: Math.round(n('cap')),
    });
  },
};
