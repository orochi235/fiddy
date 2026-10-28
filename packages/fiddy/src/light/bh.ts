/** A branching structure as flat arrays: each element's children, and whether it continues its
 *  parent's axis (`main`) or leaves it as a lateral. */
export interface Branching {
  children: readonly (readonly number[])[];
  main: readonly boolean[];
}

/** Borchert–Honda's split of resource `v` among siblings: in proportion to each one's light `q`,
 *  the main axis weighted by `lambda` and every lateral by 1 − `lambda`. */
export function bhSplit(v: number, q: readonly number[], main: readonly boolean[], lambda: number): number[] {
  const w = q.map((qi, i) => (main[i] ? lambda : 1 - lambda) * qi);
  const total = w.reduce((a, b) => a + b, 0);
  return w.map((x) => (total > 0 ? (v * x) / total : 0));
}

/** Sums `values` from the tips down, in place: each element ends holding its own plus all its
 *  descendants'. Returns the root's total. */
export function gather(b: Branching, root: number, values: Float64Array): number {
  for (const c of b.children[root]!) values[root]! += gather(b, c, values);
  return values[root]!;
}

/** Hands resource `v` from `root` up to the tips by `bhSplit` at every branching, given light `q`
 *  already gathered. Writes each element's share into `out`. */
export function distribute(b: Branching, root: number, v: number, q: Float64Array, lambda: number, out: Float64Array): void {
  out[root] = v;
  const kids = b.children[root]!;
  if (kids.length === 0) return;
  const shares = bhSplit(v, kids.map((c) => q[c]!), kids.map((c) => b.main[c]!), lambda);
  kids.forEach((c, i) => distribute(b, c, shares[i]!, q, lambda, out));
}
