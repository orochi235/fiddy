import type { Bud, Skeleton, TreeNode } from 'fiddy';
import { extents, type Reveal, shown } from './draw';

/** The part of `s` grown so far: whole nodes, a partway segment cut where growth has reached,
 *  and only the buds whose node has finished growing. Ids are renumbered. */
export function revealed(s: Skeleton, reveal: Reveal): Skeleton {
  const ext = extents(s.nodes);
  const ids = new Map<number, number>();
  const whole = new Set<number>();
  const nodes: TreeNode[] = [];
  for (const n of s.nodes) {
    const p = n.parent === null ? undefined : s.nodes[n.parent];
    if (n.parent !== null && !ids.has(n.parent)) continue;
    const k = shown(n, p, reveal, ext);
    if (k <= 0) continue;
    const at = (i: 0 | 1 | 2) => p!.pos[i] + (n.pos[i] - p!.pos[i]) * k;
    const pos: TreeNode['pos'] = k < 1 && p ? [at(0), at(1), at(2)] : n.pos;
    ids.set(n.id, nodes.length);
    if (k >= 1) whole.add(n.id);
    nodes.push({ ...n, id: nodes.length, parent: n.parent === null ? null : ids.get(n.parent)!, pos });
  }
  const buds: Bud[] = s.buds.filter((b) => whole.has(b.node)).map((b) => ({ ...b, node: ids.get(b.node)! }));
  return { nodes, buds };
}
