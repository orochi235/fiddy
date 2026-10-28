import { type Design, timingOf } from './design.js';
import { KINDS } from './kinds/index.js';

export interface Span {
  stage: string;
  /** Seconds into the timeline. */
  start: number;
  end: number;
}

/** When each stage grows: one after another in stack order, `grow` seconds each, instant kinds
 *  taking none. */
export function spansOf(design: Design): Span[] {
  const { grow } = timingOf(design);
  let t = 0;
  return design.stages.map((s) => {
    const start = t;
    t += KINDS[s.kind]?.instant ? 0 : grow;
    return { stage: s.id, start, end: t };
  });
}
