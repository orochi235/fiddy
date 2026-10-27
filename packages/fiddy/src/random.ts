/** A source of uniform numbers in [0, 1). */
export type Rng = () => number;

/** FNV-1a over the string's UTF-16 units. */
export function hashString(s: string, h = 0x811c9dc5): number {
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The random stream a stage draws from: fixed by the design's seed and the stage's id alone,
 *  so editing or reordering other stages never changes it. */
export const streamFor = (seed: number, stageId: string): Rng => mulberry32(hashString(stageId, hashString(String(seed))));
