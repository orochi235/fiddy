import { animate, type Animator, type Design } from 'fiddy';
import { useMemo } from 'react';
import './Score.css';

const W = 1000;
const ROW = 14;
const SAMPLES = 96;

interface Curve {
  label: string;
  points: string;
}

/** Each motion's param over one loop, sampled from a mix of its own so the playing one is not
 *  moved. */
function curvesOf(design: Design, loop: number): Curve[] {
  const moving = design.stages.flatMap((s, i) => Object.keys(s.motion ?? {}).map((key) => ({ i, key, label: `${s.id}.${key}` })));
  if (moving.length === 0) return [];
  const sampler = animate(design);
  const values = moving.map(() => [] as number[]);
  for (let k = 0; k < SAMPLES; k++) {
    const stages = sampler.at((k / (SAMPLES - 1)) * loop * 0.9999).design.stages;
    moving.forEach((m, j) => values[j]!.push(stages[m.i]!.params[m.key] as number));
  }
  return moving.map((m, j) => {
    const v = values[j]!;
    const lo = Math.min(...v);
    const span = Math.max(...v) - lo || 1;
    const points = v.map((y, k) => `${((k / (SAMPLES - 1)) * W).toFixed(1)},${(ROW - 2 - ((y - lo) / span) * (ROW - 4)).toFixed(1)}`).join(' ');
    return { label: m.label, points };
  });
}

interface Props {
  design: Design;
  animator: Animator;
  t: number;
  onSeek: (t: number) => void;
}

/** The design's timeline: a band per stage where it grows, a curve per motion, and the playhead. */
export function Score({ design, animator, t, onSeek }: Props) {
  const { loop } = animator;
  const bands = animator.spans.filter((s) => s.end > s.start);
  const curves = useMemo(() => curvesOf(design, loop), [design, loop]);
  const rows = bands.length + curves.length;
  const height = Math.max(1, rows) * ROW;
  const x = (sec: number) => (sec / loop) * W;

  const seek = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.buttons !== 1 && e.type !== 'pointerdown') return;
    const r = e.currentTarget.getBoundingClientRect();
    onSeek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * loop);
  };

  return (
    <svg className="fd-score" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" onPointerDown={seek} onPointerMove={seek}>
      {bands.map((b, i) => (
        <g key={b.stage}>
          <rect className="fd-score-band" x={x(b.start)} y={i * ROW + 2} width={x(b.end) - x(b.start)} height={ROW - 4} rx={2} />
          <title>{`${b.stage}: grows ${b.start.toFixed(1)}–${b.end.toFixed(1)} s`}</title>
        </g>
      ))}
      {curves.map((c, j) => (
        <g key={c.label} transform={`translate(0 ${(bands.length + j) * ROW})`}>
          <polyline className="fd-score-curve" points={c.points} vectorEffect="non-scaling-stroke" />
          <title>{c.label}</title>
        </g>
      ))}
      <line className="fd-score-head" x1={x(t)} x2={x(t)} y1={0} y2={height} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
