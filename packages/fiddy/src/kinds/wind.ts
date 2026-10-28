import { blow } from '../wind.js';
import type { StageKind } from './types.js';

/** The tree grown before it, bent by wind at the loop's clock. Takes no growth time, and bends
 *  the whole tree whatever its selector says. */
export const wind: StageKind = {
  kind: 'wind',
  title: 'Wind',
  instant: true,
  clocked: true,
  whole: true,
  params: [
    { key: 'strength', label: 'Strength', type: 'number', default: 12, min: 0, max: 90, step: 0.5, suffix: '°' },
    { key: 'direction', label: 'Direction', type: 'number', default: 0, min: -180, max: 180, step: 1, suffix: '°' },
    { key: 'gustiness', label: 'Gustiness', type: 'number', default: 0.5, min: 0, max: 1, step: 0.01 },
    { key: 'gusts', label: 'Gusts / loop', type: 'number', default: 2, min: 0, max: 16, step: 1 },
    { key: 'sway', label: 'Sways / loop', type: 'number', default: 4, min: 0, max: 32, step: 1 },
    { key: 'flex', label: 'Flex exponent', type: 'number', default: 3, min: 2, max: 6, step: 0.1 },
    { key: 'turbulence', label: 'Turbulence', type: 'number', default: 0.3, min: 0, max: 1, step: 0.01 },
  ],
  apply({ params, buds, nodes, rng, clock }) {
    // Whole cycles per loop, so the wind meets itself where the loop wraps.
    const cycles = (key: string) => Math.max(0, Math.round(params[key] as number));
    const w = {
      strength: params.strength as number,
      direction: params.direction as number,
      gustiness: params.gustiness as number,
      gusts: cycles('gusts'),
      sway: cycles('sway'),
      flex: params.flex as number,
      turbulence: params.turbulence as number,
    };
    return blow(nodes, buds, w, clock, Math.floor(rng() * 2 ** 32));
  },
};
