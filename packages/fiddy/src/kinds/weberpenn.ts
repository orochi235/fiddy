import type { ParamValue } from '../design.js';
import { type Frame, forward, roll, tidy, yaw } from '../frame.js';
import type { Rng } from '../random.js';
import type { Bud, TreeNode } from '../skeleton.js';
import type { ParamSpec, StageKind } from './types.js';

const RAD = Math.PI / 180;

/** Weber & Penn's shape ratios: a first-level branch's length factor at `r`, its distance from the
 *  trunk's tip over the trunk's branched length (1 at the lowest branch, 0 at the tip). */
export const SHAPES: Readonly<Record<string, (r: number) => number>> = {
  conical: (r) => 0.2 + 0.8 * r,
  spherical: (r) => 0.2 + 0.8 * Math.sin(Math.PI * r),
  hemispherical: (r) => 0.2 + 0.8 * Math.sin((Math.PI / 2) * r),
  cylindrical: () => 1,
  'tapered cylindrical': (r) => 0.5 + 0.5 * r,
  flame: (r) => (r <= 0.7 ? r / 0.7 : (1 - r) / 0.3),
  'inverse conical': (r) => 1 - 0.8 * r,
  'tend flame': (r) => (r <= 0.7 ? 0.5 + (0.5 * r) / 0.7 : 0.5 + (0.5 * (1 - r)) / 0.3),
};

/** The deepest branch level the stage grows; the trunk is level 0. */
export const MAX_LEVEL = 3;

const LEVEL_DEFAULTS = [
  { branches: 20, length: 0.45, angle: 60 },
  { branches: 8, length: 0.5, angle: 45 },
  { branches: 4, length: 0.5, angle: 40 },
];

const levelParams = (n: number): ParamSpec[] => {
  const d = LEVEL_DEFAULTS[n - 1]!;
  return [
    { key: `branches${n}`, label: `Branches ${n}`, type: 'number', default: d.branches, min: 0, max: 60, step: 1 },
    { key: `length${n}`, label: `Length ${n}`, type: 'number', default: d.length, min: 0.01, max: 1.5, step: 0.01 },
    { key: `angle${n}`, label: `Angle ${n}`, type: 'number', default: d.angle, min: 0, max: 180, step: 1, suffix: '°' },
  ];
};

/** A Weber–Penn stage's params with defaults filled; `level[n - 1]` holds branch level n's. */
export function weberPennParams(p: Record<string, ParamValue>) {
  const num = (k: string) => p[k] as number;
  return {
    levels: Math.max(0, Math.min(MAX_LEVEL, Math.round(num('levels')))),
    length: num('length'),
    width: num('width'),
    taper: num('taper'),
    ratioPower: num('ratioPower'),
    base: num('base'),
    shape: SHAPES[String(p.shape)] ?? SHAPES.conical!,
    segments: Math.max(1, Math.round(num('segments'))),
    curve: num('curve') * RAD,
    bend: num('bend') * RAD,
    rotate: num('rotate') * RAD,
    vary: num('vary'),
    level: [1, 2, 3].map((n) => ({
      branches: Math.max(0, Math.round(num(`branches${n}`))),
      length: num(`length${n}`),
      angle: num(`angle${n}`) * RAD,
    })),
  };
}

type Params = ReturnType<typeof weberPennParams>;

interface Stem {
  frame: Frame;
  /** The node the stem's first segment hangs from. */
  parent: number;
  length: number;
  radius: number;
  /** Arc length from the stage's start to the stem's base. */
  born: number;
  order: number;
  level: number;
}

interface Grower {
  p: Params;
  nodes: TreeNode[];
  rng: Rng;
  stage: string;
  out: Bud[];
}

/** `x` scaled by a random factor in 1 ± vary. */
const jitter = (g: Grower, x: number) => x * (1 + g.p.vary * (2 * g.rng() - 1));

/** One stem as a polyline of `segments` pieces bending by its curve, with a node at every child's
 *  offset, then its children depth first. Leaves a bud at its tip. */
function growStem(g: Grower, s: Stem): void {
  const { p, nodes } = g;
  const next = s.level + 1;
  const count = next <= p.levels ? p.level[next - 1]!.branches : 0;
  const base = s.level === 0 ? p.base * s.length : 0;
  const offsets = Array.from({ length: count }, (_, k) => base + ((s.length - base) * (k + 0.5)) / count);
  const segLen = s.length / p.segments;
  const stops = [
    ...Array.from({ length: p.segments }, (_, j) => ({ d: j === p.segments - 1 ? s.length : (j + 1) * segLen, end: j + 1 })),
    ...offsets.map((d, k) => ({ d, child: k })),
  ].sort((a, b) => a.d - b.d);
  // Branches bend back toward their parent's axis, which their own yaw turned them away from.
  const curve = (s.level === 0 ? p.curve : -p.bend) / p.segments;
  const radiusAt = (d: number) => s.radius * Math.max(0.01, 1 - (p.taper * d) / s.length);

  let f = s.frame;
  let at = s.parent;
  let dist = 0;
  let placed = -1;
  const attach: { node: number; frame: Frame }[] = [];
  for (const stop of stops) {
    if (stop.d - dist > 1e-9 || placed < 0) {
      f = forward(f, stop.d - dist);
      dist = stop.d;
      placed = nodes.length;
      nodes.push({ id: placed, parent: at, pos: f.pos, radius: radiusAt(dist), order: s.order, stage: g.stage, born: s.born + dist });
      at = placed;
    }
    if ('child' in stop) attach.push({ node: placed, frame: f });
    else if (stop.end < p.segments) f = tidy(yaw(f, jitter(g, curve)));
  }
  g.out.push({ node: at, frame: f, order: s.order, vigor: 1 });

  let spin = 0;
  attach.forEach(({ node, frame }, k) => {
    const d = offsets[k]!;
    const lv = p.level[next - 1]!;
    const nominal = next === 1 ? lv.length * s.length * p.shape((s.length - d) / (s.length - base)) : lv.length * (s.length - 0.6 * d);
    const length = Math.max(1e-3, jitter(g, nominal));
    spin += jitter(g, p.rotate);
    const radius = Math.min(radiusAt(d), s.radius * (length / s.length) ** p.ratioPower);
    const child = tidy(yaw(roll(frame, spin), jitter(g, lv.angle)));
    growStem(g, { frame: child, parent: node, length, radius, born: s.born + d, order: s.order + 1, level: next });
  });
}

/** A simplified Weber & Penn (1995) tree from each selected bud: a trunk, then up to three levels of
 *  branches, each stem a curved, tapering polyline with its children spread along it. */
export const weberPenn: StageKind = {
  kind: 'weberpenn',
  title: 'Weber–Penn',
  brief: ['levels', 'length', 'branches1'],
  params: [
    { key: 'levels', label: 'Levels', type: 'number', default: 2, min: 0, max: MAX_LEVEL, step: 1 },
    { key: 'shape', label: 'Shape', type: 'choice', default: 'conical', options: Object.keys(SHAPES) },
    { key: 'length', label: 'Trunk length', type: 'number', default: 10, min: 0.1, max: 100, step: 0.1 },
    { key: 'width', label: 'Trunk width', type: 'number', default: 0.5, min: 0.01, max: 10, step: 0.01 },
    { key: 'base', label: 'Bare trunk', type: 'number', default: 0.3, min: 0, max: 0.95, step: 0.01 },
    { key: 'taper', label: 'Taper', type: 'number', default: 0.9, min: 0, max: 1, step: 0.01 },
    { key: 'ratioPower', label: 'Radius power', type: 'number', default: 1.3, min: 0, max: 3, step: 0.05 },
    { key: 'segments', label: 'Segments', type: 'number', default: 6, min: 1, max: 20, step: 1 },
    { key: 'curve', label: 'Trunk curve', type: 'number', default: 0, min: -180, max: 180, step: 1, suffix: '°' },
    { key: 'bend', label: 'Branch bend', type: 'number', default: 20, min: -180, max: 180, step: 1, suffix: '°' },
    { key: 'rotate', label: 'Rotate', type: 'number', default: 140, min: 0, max: 360, step: 1, suffix: '°' },
    { key: 'vary', label: 'Vary', type: 'number', default: 0.2, min: 0, max: 1, step: 0.01 },
    ...levelParams(1),
    ...levelParams(2),
    ...levelParams(3),
  ],
  apply({ stage, params, buds, nodes, rng }) {
    const p = weberPennParams(params);
    const g: Grower = { p, nodes, rng, stage: stage.id, out: [] };
    for (const bud of buds) {
      growStem(g, { frame: bud.frame, parent: bud.node, length: p.length, radius: p.width, born: 0, order: bud.order, level: 0 });
    }
    return g.out;
  },
};
