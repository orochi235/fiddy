/** An indexed triangle mesh: three floats per vertex in `positions` and `normals`. */
export interface Mesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

/** The meshes as one, indices shifted to match. */
export function joinMeshes(...meshes: readonly Mesh[]): Mesh {
  const b = new MeshBuilder();
  for (const m of meshes) {
    const base = b.positions.length / 3;
    b.positions.push(...m.positions);
    b.normals.push(...m.normals);
    for (const i of m.indices) b.indices.push(base + i);
  }
  return b.build();
}

/** A mesh under construction, grown with plain arrays and frozen once. */
export class MeshBuilder {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly indices: number[] = [];

  /** Adds a vertex and returns its index. */
  vertex(p: readonly number[], n: readonly number[]): number {
    this.positions.push(p[0]!, p[1]!, p[2]!);
    this.normals.push(n[0]!, n[1]!, n[2]!);
    return this.positions.length / 3 - 1;
  }

  triangle(a: number, b: number, c: number): void {
    this.indices.push(a, b, c);
  }

  build(): Mesh {
    return { positions: new Float32Array(this.positions), normals: new Float32Array(this.normals), indices: new Uint32Array(this.indices) };
  }
}
