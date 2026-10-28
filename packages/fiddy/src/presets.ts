import { type Design, restack, type Stage } from './design.js';

export interface Preset {
  name: string;
  /** Where it comes from, when it is from the book. */
  source?: string;
  design: () => Design;
}

const seed = (): Stage => ({ id: 'seed', kind: 'seed', params: {}, input: { from: [] } });

function lsystem(id: string, grammar: string, n: number, delta: number, more: Stage['params'] = {}, select?: Stage['input']['select']): Stage {
  return { id, kind: 'lsystem', params: { grammar, n, delta, ...more }, input: { from: [], ...(select ? { select } : {}) } };
}

const weberPenn = (id: string, params: Stage['params']): Stage => ({ id, kind: 'weberpenn', params, input: { from: [] } });

const one = (grammar: string, n: number, delta: number) => (): Design => ({
  seed: 1,
  stages: restack([seed(), lsystem('plant', grammar, n, delta)]),
});

/** The bracketed plants of *The Algorithmic Beauty of Plants*, Figs. 1.24 and 1.27, Weber–Penn trees, and designs built on them. */
export const PRESETS: readonly Preset[] = [
  { name: 'Fig. 1.24a', source: 'ABOP Fig. 1.24a', design: one('ω: F\np1: F → F[+F]F[-F]F', 5, 25.7) },
  { name: 'Fig. 1.24b', source: 'ABOP Fig. 1.24b', design: one('ω: F\np1: F → F[+F]F[-F][F]', 5, 20) },
  { name: 'Fig. 1.24c', source: 'ABOP Fig. 1.24c', design: one('ω: F\np1: F → FF-[-F+F+F]+[+F-F-F]', 4, 22.5) },
  { name: 'Fig. 1.24d', source: 'ABOP Fig. 1.24d', design: one('ω: X\np1: X → F[+X]F[-X]+X\np2: F → FF', 7, 20) },
  { name: 'Fig. 1.24e', source: 'ABOP Fig. 1.24e', design: one('ω: X\np1: X → F[+X][-X]FX\np2: F → FF', 7, 25.7) },
  { name: 'Fig. 1.24f', source: 'ABOP Fig. 1.24f', design: one('ω: X\np1: X → F-[[X]+X]+F[+FX]-X\np2: F → FF', 5, 22.5) },
  {
    name: 'Fig. 1.27',
    source: 'ABOP Fig. 1.27',
    design: one('ω: F\np1: F (.33) → F[+F]F[-F]F\np2: F (.33) → F[+F]F\np3: F (.34) → F[-F]F', 5, 25.7),
  },
  {
    name: 'Grafted',
    design: () => ({
      seed: 1,
      stages: restack([
        seed(),
        lsystem('trunk', 'ω: FA\np1: A → !F[+FA][-FA]', 3, 30, { step: 4, width: 2 }),
        lsystem('crown', 'ω: X\np1: X → F[+X][-X]FX\np2: F → FF', 4, 25.7, { width: 0.6 }, { minOrder: 2 }),
      ]),
    }),
  },
  {
    name: 'Grafted, wild',
    design: () => ({
      seed: 1,
      stages: restack([
        seed(),
        lsystem('trunk', 'ω: FA\np1: A → !F[+FA][-FA]', 3, 30, { step: 4, width: 2 }),
        lsystem('crown', 'ω: X\np1: X (.5) → F[+X][-X]FX\np2: X (.3) → F[+X]FX\np3: X (.2) → F[-X]FX\np4: F → FF', 4, 25.7, { width: 0.6 }, { minOrder: 2 }),
      ]),
    }),
  },
  {
    name: 'Weber–Penn',
    design: () => ({
      seed: 1,
      stages: restack([
        seed(),
        weberPenn('tree', { levels: 3, length: 12, width: 0.6, branches1: 16, branches2: 6, branches3: 3, curve: 8, bend: 30 }),
      ]),
    }),
  },
  {
    name: 'Weber–Penn, L-system twigs',
    design: () => ({
      seed: 1,
      stages: restack([
        seed(),
        weberPenn('limbs', { levels: 2, shape: 'spherical', length: 10, width: 0.6, branches1: 12, branches2: 5, rotate: 180, bend: 25 }),
        lsystem('twigs', 'ω: X\np1: X → F[+X][-X]FX\np2: F → FF', 3, 25.7, { step: 0.12, width: 0.05 }, { minOrder: 2 }),
      ]),
    }),
  },
];
