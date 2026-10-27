import type { Skeleton } from 'fiddy';
import { useEffect, useRef } from 'react';
import { drawSkeleton } from '../tree/draw';

/** A small fixed-size drawing of a skeleton. */
export function Thumb({ skeleton, size, className }: { skeleton: Skeleton; size: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const dpr = devicePixelRatio;
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSkeleton(ctx, skeleton, { width: size, height: size, pad: 4, weight: 0.05 });
  }, [skeleton, size]);
  return <canvas ref={ref} className={className} width={size} height={size} />;
}
