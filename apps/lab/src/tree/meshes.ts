import { leafMesh, type Mesh, type Skeleton, toGlb, tubeMesh } from 'fiddy';
import { Color } from 'three';
import { BARK, LEAF } from '../colors';
import { WEIGHT } from './draw';

/** How the 3D tree is dressed. */
export interface Look {
  /** Leaf length as a share of the finished tree's size; 0 leaves the tree bare. */
  leaf: number;
}

export const DEFAULT_LOOK: Look = { leaf: 0.03 };

function sizeOf(s: Skeleton): number {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const n of s.nodes) {
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k]!, n.pos[k as 0 | 1 | 2]);
      hi[k] = Math.max(hi[k]!, n.pos[k as 0 | 1 | 2]);
    }
  }
  return s.nodes.length === 0 ? 1 : Math.max(1e-3, ...hi.map((h, k) => h - lo[k]!));
}

/** The bark and leaves of `s`, sized against `finished` so they stay put while the tree grows. */
export function treeMeshes(s: Skeleton, finished: Skeleton, look: Look): { bark: Mesh; leaves: Mesh } {
  const size = sizeOf(finished);
  const bark = tubeMesh(s, { sides: 8, radiusScale: WEIGHT / 2, minRadius: size * 4e-4 });
  const leaves = look.leaf > 0 ? leafMesh(s, { size: look.leaf * size }) : leafMesh({ nodes: [], buds: [] }, { size: 1 });
  return { bark, leaves };
}

const linear = (hex: string): [number, number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b, 1];
};

/** Downloads the finished tree as a binary glTF, dressed as the view shows it. */
export function downloadGlb(finished: Skeleton, look: Look, name: string): void {
  const { bark, leaves } = treeMeshes(finished, finished, look);
  const glb = toGlb([
    { name: 'bark', mesh: bark, color: linear(BARK) },
    { name: 'leaves', mesh: leaves, color: linear(LEAF), doubleSided: true },
  ]);
  const url = URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[^\w.-]+/g, '-').toLowerCase() || 'tree'}.glb`;
  a.click();
  URL.revokeObjectURL(url);
}
