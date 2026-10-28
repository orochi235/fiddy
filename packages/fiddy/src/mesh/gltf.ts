import type { Mesh } from './types.js';

export interface GlbPart {
  name: string;
  mesh: Mesh;
  /** Linear RGBA, 0–1. */
  color: readonly [number, number, number, number];
  doubleSided?: boolean;
}

const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;
const FLOAT = 5126;
const UNSIGNED_INT = 5125;

function bounds(positions: Float32Array): { min: number[]; max: number[] } {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k]!, positions[i + k]!);
      max[k] = Math.max(max[k]!, positions[i + k]!);
    }
  }
  return { min, max };
}

const pad4 = (n: number) => (n + 3) & ~3;

/** The parts as one binary glTF 2.0 file: a node, mesh, and material each, Y up. Parts with no
 *  triangles are left out, since glTF forbids empty accessors. */
export function toGlb(parts: readonly GlbPart[]): Uint8Array<ArrayBuffer> {
  const used = parts.filter((p) => p.mesh.indices.length > 0);
  const chunks: ArrayBufferView[] = [];
  const bufferViews: object[] = [];
  const accessors: object[] = [];
  let offset = 0;
  const view = (data: Float32Array | Uint32Array, target: number) => {
    chunks.push(data);
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.byteLength, target });
    offset += data.byteLength;
    return bufferViews.length - 1;
  };

  const meshes = used.map((p, i) => {
    const count = p.mesh.positions.length / 3;
    accessors.push({ bufferView: view(p.mesh.positions, ARRAY_BUFFER), componentType: FLOAT, count, type: 'VEC3', ...bounds(p.mesh.positions) });
    accessors.push({ bufferView: view(p.mesh.normals, ARRAY_BUFFER), componentType: FLOAT, count, type: 'VEC3' });
    accessors.push({ bufferView: view(p.mesh.indices, ELEMENT_ARRAY_BUFFER), componentType: UNSIGNED_INT, count: p.mesh.indices.length, type: 'SCALAR' });
    const a = accessors.length - 3;
    return { name: p.name, primitives: [{ attributes: { POSITION: a, NORMAL: a + 1 }, indices: a + 2, material: i }] };
  });

  const json = {
    asset: { version: '2.0', generator: 'fiddy' },
    scene: 0,
    scenes: [{ nodes: used.map((_, i) => i) }],
    nodes: used.map((p, i) => ({ name: p.name, mesh: i })),
    meshes,
    materials: used.map((p) => ({
      name: p.name,
      pbrMetallicRoughness: { baseColorFactor: [...p.color], metallicFactor: 0, roughnessFactor: 0.9 },
      doubleSided: p.doubleSided ?? false,
    })),
    accessors,
    bufferViews,
    buffers: [{ byteLength: offset }],
  };

  // Escaped to ASCII, so each character is one byte of the UTF-8 the format requires.
  const ascii = JSON.stringify(json).replace(/[\u0080-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  const text = Uint8Array.from(ascii, (c) => c.charCodeAt(0));
  const jsonLength = pad4(text.length);
  const binLength = pad4(offset);
  const total = 12 + 8 + jsonLength + 8 + binLength;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonLength, true);
  dv.setUint32(16, 0x4e4f534a, true);
  out.set(text, 20);
  out.fill(0x20, 20 + text.length, 20 + jsonLength);
  let at = 20 + jsonLength;
  dv.setUint32(at, binLength, true);
  dv.setUint32(at + 4, 0x004e4942, true);
  at += 8;
  for (const c of chunks) {
    out.set(new Uint8Array(c.buffer, c.byteOffset, c.byteLength), at);
    at += c.byteLength;
  }
  return out;
}
