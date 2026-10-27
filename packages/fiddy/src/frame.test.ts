import { describe, expect, it } from 'vitest';
import { forward, pitch, roll, tidy, UPRIGHT, yaw, type Frame } from './frame.js';
import { streamFor } from './random.js';
import { cross, dot, length } from './vec.js';

const near = (a: readonly number[], b: readonly number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 9));

function expectOrthonormal(f: Frame) {
  for (const v of [f.heading, f.left, f.up]) expect(length(v)).toBeCloseTo(1, 9);
  expect(dot(f.heading, f.left)).toBeCloseTo(0, 9);
  near(cross(f.heading, f.left), f.up);
}

describe('frame', () => {
  it('yaws left with + as ABOP draws it: heading up turns toward -x', () => {
    near(yaw(UPRIGHT, Math.PI / 2).heading, [-1, 0, 0]);
  });

  it('keeps every rotation orthonormal and undoes each by its negative', () => {
    for (const op of [yaw, pitch, roll]) {
      const turned = op(op(UPRIGHT, 0.7), -0.3);
      expectOrthonormal(turned);
      const back = op(op(turned, 0.3), -0.7);
      near(back.heading, UPRIGHT.heading);
      near(back.up, UPRIGHT.up);
    }
  });

  it('pitches the heading down, away from up', () => {
    near(pitch(UPRIGHT, Math.PI / 2).heading, [0, 0, -1]);
  });

  it('moves along the heading', () => {
    near(forward(yaw(UPRIGHT, Math.PI / 2), 2).pos, [-2, 0, 0]);
  });

  it('tidies drift back to orthonormal', () => {
    expectOrthonormal(tidy({ ...UPRIGHT, heading: [0.01, 1.02, 0] }));
  });
});

describe('streamFor', () => {
  it('repeats for one stage id and differs between ids', () => {
    const a = streamFor(7, 'trunk');
    const b = streamFor(7, 'trunk');
    const c = streamFor(7, 'crown');
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect([c(), c(), c()]).not.toEqual(first);
  });
});
