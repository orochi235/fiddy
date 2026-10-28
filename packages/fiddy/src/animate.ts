import { type Channel, keys, mix, type Patch, patch, sum, wave } from '@msb235/blits';
import { type Design, type Stage, timingOf } from './design.js';
import { KINDS } from './kinds/index.js';
import type { Motion } from './motion.js';

/** The design at one moment: every moving param fixed, and how far each stage has grown, 0–1. */
export interface Moment {
  design: Design;
  grown: Record<string, number>;
}

export interface Animator {
  /** Whether the design changes over the loop: a param moves, or a stage follows the clock. */
  readonly moving: boolean;
  /** Seconds one loop lasts. */
  readonly loop: number;
  /** When each stage grows, in seconds into the loop. */
  readonly spans: readonly { stage: string; start: number; end: number }[];
  /** The design `seconds` into its timeline. Any time is allowed; the loop repeats. */
  at(seconds: number): Moment;
}

const SUBJECT = 'design';
type Pose = Record<string, number>;

const CLOCK = 'clock';
const growChannel = (stage: string) => `grow.${stage}`;
const paramChannel = (stage: string, key: string) => `${stage}.${key}`;

/** When each stage grows: one after another in stack order, `grow` seconds each, instant kinds
 *  taking none. Start times are absolute rather than blits anchors, so the mix reads back at
 *  any time without a history tape. */
function spansOf(design: Design) {
  const { grow } = timingOf(design);
  let t = 0;
  return design.stages.map((s) => {
    const start = t;
    t += KINDS[s.kind]?.instant ? 0 : grow;
    return { stage: s.id, start, end: t };
  });
}

function motionPatch(channel: string, motion: Motion, loopMs: number, kit: Record<string, Channel<number>>): Patch<string, Pose, unknown> {
  const own = { [channel]: kit[channel]! };
  if (motion.kind === 'keys') {
    return keys<string, Pose>(
      loopMs,
      motion.stops.map((s) => ({ at: s.at, delta: { [channel]: s.value } })),
      { ease: motion.ease, kit: own },
    );
  }
  const { shape, cycles, phase, depth } = motion;
  return wave<string, Pose>(loopMs, { shape, cycles, phase, depth: { [channel]: depth }, kit: own });
}

/** One blits mix over the design's timeline: a looping voice that grows each stage in turn and
 *  holds the finished tree, a looping voice per param motion, and the loop's clock. A wave adds
 *  to the set value; keys replace it. */
export function animate(design: Design): Animator {
  const { loop } = timingOf(design);
  const loopMs = loop * 1000;
  const spans = spansOf(design);
  const movers = design.stages.flatMap((s) =>
    Object.entries(s.motion ?? {})
      .filter(([key]) => typeof s.params[key] === 'number')
      .map(([key, motion]) => ({ channel: paramChannel(s.id, key), motion })),
  );

  const kit: Record<string, Channel<number>> = {};
  for (const s of spans) kit[growChannel(s.stage)] = sum();
  for (const m of movers) kit[m.channel] = sum();
  kit[CLOCK] = sum();
  const timeline = mix<string, Pose>(kit);

  const growth = patch<string, Pose>(
    loopMs,
    (phase) => {
      const t = phase * loop;
      const out: Pose = {};
      for (const s of spans) out[growChannel(s.stage)] = s.end === s.start ? 1 : Math.min(1, Math.max(0, (t - s.start) / (s.end - s.start)));
      return out;
    },
    { writes: spans.map((s) => growChannel(s.stage)) },
  );
  timeline.cue({ patch: growth, loop: true, start: 0 });
  timeline.cue({ patch: patch<string, Pose>(loopMs, (phase) => ({ [CLOCK]: phase }), { writes: [CLOCK] }), loop: true, start: 0 });
  for (const m of movers) timeline.cue({ patch: motionPatch(m.channel, m.motion, loopMs, kit), loop: true, start: 0 });

  // The mix's clock runs forward only: an earlier point in the loop is reached by wrapping
  // forward to the same point in a later pass.
  let pass = 0;
  let last = -1;
  const pose: Pose = {};
  return {
    moving: movers.length > 0 || design.stages.some((s) => KINDS[s.kind]?.clocked),
    loop,
    spans,
    at(seconds) {
      const into = (((seconds * 1000) % loopMs) + loopMs) % loopMs;
      let ms = pass * loopMs + into;
      if (ms < last) {
        pass += 1;
        ms += loopMs;
      }
      last = ms;
      timeline.sync(ms);
      timeline.probe(SUBJECT, pose);
      const read = (channel: string) => {
        const v = pose[channel];
        return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
      };
      const grown: Record<string, number> = {};
      for (const s of spans) grown[s.stage] = read(growChannel(s.stage)) ?? 1;
      const clock = read(CLOCK) ?? 0;
      return { design: { ...design, clock, stages: design.stages.map((s) => settle(s, read)) }, grown };
    },
  };
}

/** The stage with each moving param read from `read`, and no motions. */
function settle(stage: Stage, read: (channel: string) => number | undefined): Stage {
  const { motion, ...rest } = stage;
  if (!motion) return rest;
  const params = { ...stage.params };
  for (const [key, m] of Object.entries(motion)) {
    const set = params[key];
    if (typeof set !== 'number') continue;
    const v = read(paramChannel(stage.id, key));
    if (v === undefined) continue;
    params[key] = m.kind === 'wave' ? set + v : v;
  }
  return { ...rest, params };
}
