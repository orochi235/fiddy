import { length, scale, type Vec3 } from '../vec.js';

const OFFSET = 1 << 15;
const SPAN = 1 << 16;

/**
 * Palubicki's shadow voxels, kept sparse. Each bud shades a pyramid of voxels below it (world y is
 * up): its own voxel by `strength`, and each layer `q` down, (2q + 1)² voxels wide, by `strength`
 * scaled down linearly to nothing past `depth` layers.
 */
export class ShadowGrid {
  private readonly cells = new Map<number, number>();

  constructor(
    readonly size: number,
    readonly strength: number,
    readonly depth: number,
  ) {}

  private cell(p: Vec3): [number, number, number] {
    return [Math.floor(p[0] / this.size), Math.floor(p[1] / this.size), Math.floor(p[2] / this.size)];
  }

  private key = (i: number, j: number, k: number) => ((i + OFFSET) * SPAN + (j + OFFSET)) * SPAN + (k + OFFSET);

  private at(i: number, j: number, k: number): number {
    return this.cells.get(this.key(i, j, k)) ?? 0;
  }

  /** The shade a bud casts `q` layers below itself. */
  layer(q: number): number {
    return this.strength * (1 - q / (this.depth + 1));
  }

  /** Adds the shadow of a bud at `p`, or with `sign` −1 takes it away again. */
  cast(p: Vec3, sign: 1 | -1 = 1): void {
    const [i, j, k] = this.cell(p);
    for (let q = 0; q <= this.depth; q++) {
      const s = sign * this.layer(q);
      for (let di = -q; di <= q; di++) {
        for (let dk = -q; dk <= q; dk++) {
          const key = this.key(i + di, j - q, k + dk);
          this.cells.set(key, (this.cells.get(key) ?? 0) + s);
        }
      }
    }
  }

  /** The shade at `p`. */
  shade(p: Vec3): number {
    const [i, j, k] = this.cell(p);
    return this.at(i, j, k);
  }

  /** The light a bud at `p` receives, from 1 in the open down to 0, not counting its own shadow. */
  exposure(p: Vec3): number {
    return Math.min(1, Math.max(0, 1 - (this.shade(p) - this.strength)));
  }

  /** The direction shade falls off fastest from `p`, unit length, or zero where it is even. */
  lightward(p: Vec3): Vec3 {
    const [i, j, k] = this.cell(p);
    const g: Vec3 = [this.at(i - 1, j, k) - this.at(i + 1, j, k), this.at(i, j - 1, k) - this.at(i, j + 1, k), this.at(i, j, k - 1) - this.at(i, j, k + 1)];
    const l = length(g);
    return l > 1e-9 ? scale(g, 1 / l) : [0, 0, 0];
  }
}
