import { colonize, pipeRadii, type Root } from '../colonize/colonize.js';
import { type Envelope, scatter, SHAPES, type Shape } from '../colonize/envelope.js';
import type { ParamValue } from '../design.js';
import { aimed } from '../frame.js';
import type { Bud, TreeNode } from '../skeleton.js';
import { add, distance, length, normalize, scale, sub, type Vec3 } from '../vec.js';
import type { StageKind } from './types.js';

export const colonizeParams = (p: Record<string, ParamValue>) => ({
  shape: (SHAPES.includes(p.shape as Shape) ? p.shape : 'ellipsoid') as Shape,
  points: Math.max(0, Math.round(p.points as number)),
  width: p.width as number,
  height: p.height as number,
  gap: p.gap as number,
  step: p.step as number,
  influence: p.influence as number,
  kill: p.kill as number,
  iterations: Math.max(0, Math.round(p.iterations as number)),
  tip: p.tip as number,
  pipe: p.pipe as number,
});

/** The crown the buds grow into: its axis along their mean heading, its base `gap` beyond their
 *  mean position along it. */
export function envelopeFor(buds: readonly Bud[], p: ReturnType<typeof colonizeParams>): Envelope {
  let pos: Vec3 = [0, 0, 0];
  let heading: Vec3 = [0, 0, 0];
  for (const b of buds) {
    pos = add(pos, b.frame.pos);
    heading = add(heading, b.frame.heading);
  }
  pos = scale(pos, 1 / Math.max(1, buds.length));
  if (length(heading) < 1e-9) heading = [0, 1, 0];
  const left = buds[0]?.frame.left ?? [-1, 0, 0];
  const axis = normalize(heading);
  return { shape: p.shape, frame: aimed(add(pos, scale(axis, p.gap)), axis, left), width: p.width, height: p.height };
}

/** Space colonization: attraction points scattered through a crown, which the selected buds grow
 *  toward and into, with pipe-model radii. */
export const colonizeKind: StageKind = {
  kind: 'colonize',
  title: 'Space colonization',
  brief: ['points', 'influence', 'kill'],
  params: [
    { key: 'shape', label: 'Crown', type: 'choice', default: 'ellipsoid', options: SHAPES },
    { key: 'points', label: 'Points', type: 'number', default: 1500, min: 0, max: 20000, step: 10 },
    { key: 'width', label: 'Width', type: 'number', default: 40, min: 1, max: 400, step: 0.5 },
    { key: 'height', label: 'Height', type: 'number', default: 30, min: 1, max: 400, step: 0.5 },
    { key: 'gap', label: 'Gap', type: 'number', default: 15, min: 0, max: 200, step: 0.5 },
    { key: 'step', label: 'Step', type: 'number', default: 1, min: 0.05, max: 10, step: 0.05 },
    { key: 'influence', label: 'Influence', type: 'number', default: 12, min: 0.1, max: 100, step: 0.1 },
    { key: 'kill', label: 'Kill', type: 'number', default: 2, min: 0.05, max: 50, step: 0.05 },
    { key: 'iterations', label: 'Iterations', type: 'number', default: 400, min: 0, max: 5000, step: 10 },
    { key: 'tip', label: 'Tip width', type: 'number', default: 0.05, min: 0.001, max: 2, step: 0.001 },
    { key: 'pipe', label: 'Pipe exponent', type: 'number', default: 2, min: 1, max: 4, step: 0.05 },
  ],
  apply({ stage, params, buds, nodes, rng }) {
    const p = colonizeParams(params);
    if (buds.length === 0) return [];
    const envelope = envelopeFor(buds, p);
    const points = scatter(envelope, p.points, rng);
    const center = add(envelope.frame.pos, scale(envelope.frame.heading, p.height / 2));
    const roots: Root[] = buds.map((b) => ({
      pos: b.frame.pos,
      heading: b.frame.heading,
      order: b.order,
      trunk: Math.ceil((distance(b.frame.pos, center) + Math.max(p.width, p.height) / 2) / p.step),
    }));
    const grown = colonize(points, roots, { influence: p.influence, kill: p.kill, step: p.step, iterations: p.iterations });
    const radii = pipeRadii(grown.nodes, p.tip, p.pipe);

    const first = nodes.length;
    const R = roots.length;
    const idOf = (i: number) => (i < R ? buds[i]!.node : first + i - R);
    const sprouted = new Set<number>();
    for (let i = R; i < grown.nodes.length; i++) {
      const g = grown.nodes[i]!;
      nodes.push({ id: idOf(i), parent: idOf(g.parent), pos: g.pos, radius: radii[i]!, order: g.order, stage: stage.id, born: g.born } satisfies TreeNode);
      sprouted.add(g.root);
    }

    const out: Bud[] = buds.filter((_, r) => !sprouted.has(r));
    for (let i = R; i < grown.nodes.length; i++) {
      const g = grown.nodes[i]!;
      if (g.children > 0) continue;
      const from = grown.nodes[g.parent]!.pos;
      const frame = aimed(g.pos, sub(g.pos, from), buds[g.root]!.frame.left);
      out.push({ node: idOf(i), frame, order: g.order, vigor: 1 });
    }
    return out;
  },
};
