import type { Vec3 } from '../vec.js';

const SPAN = 1 << 17;
const HALF = SPAN >> 1;
const clampCell = (i: number) => Math.max(-HALF, Math.min(HALF - 1, i)) + HALF;

/** A uniform grid of indexed points: cells of side `cell`, so a query reaching no further than
 *  one cell visits only the 27 around it. */
export class Grid {
  private readonly cells = new Map<number, number[]>();

  constructor(private readonly cell: number) {}

  private key(ix: number, iy: number, iz: number): number {
    return (clampCell(ix) * SPAN + clampCell(iy)) * SPAN + clampCell(iz);
  }

  insert(index: number, p: Vec3): void {
    const k = this.key(Math.floor(p[0] / this.cell), Math.floor(p[1] / this.cell), Math.floor(p[2] / this.cell));
    const list = this.cells.get(k);
    if (list) list.push(index);
    else this.cells.set(k, [index]);
  }

  /** Calls `visit` with every index in the cells within `radius` of `p`: a superset of those within it. */
  near(p: Vec3, radius: number, visit: (index: number) => void): void {
    const lo = (v: number) => Math.floor((v - radius) / this.cell);
    const hi = (v: number) => Math.floor((v + radius) / this.cell);
    for (let ix = lo(p[0]); ix <= hi(p[0]); ix++)
      for (let iy = lo(p[1]); iy <= hi(p[1]); iy++)
        for (let iz = lo(p[2]); iz <= hi(p[2]); iz++) {
          const list = this.cells.get(this.key(ix, iy, iz));
          if (list) for (const i of list) visit(i);
        }
  }
}
