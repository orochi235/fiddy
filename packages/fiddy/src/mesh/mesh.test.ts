import { describe, expect, it } from 'vitest';
import { UPRIGHT } from '../frame.js';
import { grow } from '../grow.js';
import { PRESETS } from '../presets.js';
import type { Skeleton } from '../skeleton.js';
import { toGlb } from './gltf.js';
import { leafMesh } from './leaves.js';
import { tubeMesh } from './tube.js';

/** A trunk of two segments with one branch off its middle. */
const SMALL: Skeleton = {
  nodes: [
    { id: 0, parent: null, pos: [0, 0, 0], radius: 1, order: 0, stage: 's', born: 0 },
    { id: 1, parent: 0, pos: [0, 2, 0], radius: 0.8, order: 0, stage: 's', born: 1 },
    { id: 2, parent: 1, pos: [0, 4, 0], radius: 0.6, order: 0, stage: 's', born: 2 },
    { id: 3, parent: 1, pos: [2, 3, 0], radius: 0.3, order: 1, stage: 's', born: 2 },
  ],
  buds: [
    { node: 2, frame: { ...UPRIGHT, pos: [0, 4, 0] }, order: 0, vigor: 1 },
    { node: 3, frame: { ...UPRIGHT, pos: [2, 3, 0] }, order: 1, vigor: 1 },
  ],
};

describe('tubeMesh', () => {
  it('rings every node of a run, and starts a branch from its parent', () => {
    const m = tubeMesh(SMALL, { sides: 6 });
    // The trunk's run has three rings, the branch two.
    expect(m.positions.length / 3).toBe(6 * 5);
    expect(m.indices.length).toBe(3 * 2 * 6 * 3);
    expect(Math.max(...m.indices)).toBeLessThan(m.positions.length / 3);
  });

  it('sets each ring at its radius around the axis, with unit outward normals', () => {
    const m = tubeMesh(SMALL, { sides: 8 });
    // The trunk's middle ring: around (0, 2, 0) at radius 0.8, in the plane y = 2.
    const ring = Array.from({ length: 8 }, (_, j) => 8 + j);
    for (const v of ring) {
      const [x, y, z] = [m.positions[3 * v]!, m.positions[3 * v + 1]!, m.positions[3 * v + 2]!];
      expect(y).toBeCloseTo(2);
      expect(Math.hypot(x, z)).toBeCloseTo(0.8);
      expect(Math.hypot(m.normals[3 * v]!, m.normals[3 * v + 1]!, m.normals[3 * v + 2]!)).toBeCloseTo(1);
      expect(m.normals[3 * v]! * x + m.normals[3 * v + 2]! * z).toBeGreaterThan(0);
    }
  });

  it('meshes every preset without a stray index', () => {
    for (const p of PRESETS) {
      const m = tubeMesh(grow(p.design()));
      expect(m.indices.length, p.name).toBeGreaterThan(0);
      expect(m.indices.every((i) => i < m.positions.length / 3), p.name).toBe(true);
      expect(m.positions.every(Number.isFinite), p.name).toBe(true);
    }
  });
});

describe('leafMesh', () => {
  it('puts a leaf of the given length at each bud', () => {
    const m = leafMesh(SMALL, { size: 2 });
    const perLeaf = m.positions.length / 3 / 2;
    expect(perLeaf).toBe(8);
    // The first leaf runs up its bud's heading, from y = 4 to y = 6.
    const ys = Array.from({ length: perLeaf }, (_, i) => m.positions[3 * i + 1]!);
    expect(Math.min(...ys)).toBeCloseTo(4);
    expect(Math.max(...ys)).toBeCloseTo(6);
  });
});

describe('toGlb', () => {
  it('writes a valid binary glTF whose accessors match the meshes', () => {
    const bark = tubeMesh(SMALL);
    const leaves = leafMesh(SMALL, { size: 1 });
    const empty = { positions: new Float32Array(), normals: new Float32Array(), indices: new Uint32Array() };
    const glb = toGlb([
      { name: 'bark', mesh: bark, color: [0.4, 0.3, 0.2, 1] },
      { name: 'leaves', mesh: leaves, color: [0.3, 0.6, 0.2, 1], doubleSided: true },
      { name: 'nothing', mesh: empty, color: [1, 1, 1, 1] },
    ]);
    const dv = new DataView(glb.buffer);
    expect(dv.getUint32(0, true)).toBe(0x46546c67);
    expect(dv.getUint32(4, true)).toBe(2);
    expect(dv.getUint32(8, true)).toBe(glb.length);
    const jsonLength = dv.getUint32(12, true);
    const json = JSON.parse(String.fromCharCode(...glb.subarray(20, 20 + jsonLength)));
    expect(json.meshes.map((m: { name: string }) => m.name)).toEqual(['bark', 'leaves']);
    expect(json.accessors[0].count).toBe(bark.positions.length / 3);
    expect(json.accessors[2].count).toBe(bark.indices.length);
    expect(json.materials[1].doubleSided).toBe(true);

    const bin = 20 + jsonLength + 8;
    expect(dv.getUint32(20 + jsonLength, true)).toBeGreaterThanOrEqual(json.buffers[0].byteLength);
    const view = json.bufferViews[0];
    expect(new Float32Array(glb.slice(bin + view.byteOffset, bin + view.byteOffset + view.byteLength).buffer)).toEqual(bark.positions);
  });
});
