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

const colonize = (id: string, params: Stage['params'], select?: Stage['input']['select']): Stage => ({
  id,
  kind: 'colonize',
  params,
  input: { from: [], ...(select ? { select } : {}) },
});

const one = (grammar: string, n: number, delta: number) => (): Design => ({
  seed: 1,
  stages: restack([seed(), lsystem('plant', grammar, n, delta)]),
});

/** An L-system whose turns are all written as parameters, so δ does not matter. */
const param = (grammar: string, n: number, more: Stage['params']) => (): Design => ({
  seed: 1,
  stages: restack([seed(), lsystem('plant', grammar, n, 0, more)]),
});

/** The bracketed plants of *The Algorithmic Beauty of Plants*, Figs. 1.24 to 1.31 and chapter 2, Weber–Penn trees, space-colonized crowns, and designs built on them. */
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
    name: 'Fig. 1.31a',
    source: 'ABOP Fig. 1.31a',
    design: one(
      '#ignore: +-F\nω: F1F1F1\n0 < 0 > 0 → 0\n0 < 0 > 1 → 1[+F1F1]\n0 < 1 > 0 → 1\n0 < 1 > 1 → 1\n1 < 0 > 0 → 0\n1 < 0 > 1 → 1F1\n1 < 1 > 0 → 1\n1 < 1 > 1 → 0\n* < + > * → -\n* < - > * → +',
      30,
      22.5,
    ),
  },
  {
    name: 'Fig. 2.6, monopodial',
    source: 'ABOP Fig. 2.6',
    design: param(
      '#define r1 0.9\n#define r2 0.6\n#define a0 45\n#define a2 45\n#define d 137.5\n#define wr 0.707\nω: A(1,10)\np1: A(l,w) → !(w)F(l)[&(a0)B(l*r2,w*wr)]/(d)A(l*r1,w*wr)\np2: B(l,w) → !(w)F(l)[-(a2)$C(l*r2,w*wr)]C(l*r1,w*wr)\np3: C(l,w) → !(w)F(l)[+(a2)$B(l*r2,w*wr)]B(l*r1,w*wr)',
      10,
      { width: 0.01 },
    ),
  },
  {
    name: 'Fig. 2.7, sympodial',
    source: 'ABOP Fig. 2.7',
    design: param(
      '#define r1 0.9\n#define r2 0.7\n#define a1 10\n#define a2 60\n#define wr 0.707\nω: A(1,10)\np1: A(l,w) → !(w)F(l)[&(a1)B(l*r1,w*wr)]/(180)[&(a2)B(l*r2,w*wr)]\np2: B(l,w) → !(w)F(l)[+(a1)$B(l*r1,w*wr)][-(a2)$B(l*r2,w*wr)]',
      10,
      { width: 0.01 },
    ),
  },
  {
    name: 'Fig. 2.8, ternary',
    source: 'ABOP Fig. 2.8',
    design: param(
      '#define d1 94.74\n#define d2 132.63\n#define a 18.95\n#define lr 1.109\n#define vr 1.732\nω: !(1)F(200)/(45)A\np1: A → !(vr)F(50)[&(a)F(50)A]/(d1)[&(a)F(50)A]/(d2)[&(a)F(50)A]\np2: F(l) → F(l*lr)\np3: !(w) → !(w*vr)',
      6,
      { width: 0.05 },
    ),
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
  {
    name: 'Colonized',
    design: () => ({ seed: 1, stages: restack([seed(), colonize('crown', {})]) }),
  },
  {
    name: 'Colonized, conifer',
    design: () => ({ seed: 1, stages: restack([seed(), colonize('crown', { shape: 'cone', width: 30, height: 60, gap: 4, points: 2500 })]) }),
  },
  {
    name: 'Colonized on an L-system',
    design: () => ({
      seed: 1,
      stages: restack([
        seed(),
        lsystem('trunk', 'ω: FA\np1: A → !F[+FA][-FA]', 2, 30, { step: 4, width: 2 }),
        colonize('crown', { gap: 2, width: 50, height: 28 }, { minOrder: 2 }),
      ]),
    }),
  },
];
