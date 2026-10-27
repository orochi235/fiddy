import type { Skeleton } from 'fiddy';
import { useEffect, useRef, useState } from 'react';
import { drawSkeleton, type Fit, type Hover, pick, type Reveal } from './draw';
import './TreeView.css';

interface Props {
  skeleton: Skeleton;
  /** The finished skeleton, which the view fits to so growth happens in place. */
  fitTo: Skeleton;
  reveal: Reveal;
  selected: string | null;
  hover: Hover | null;
  onHover: (hover: Hover | null) => void;
  dimmed?: boolean;
}

/** The tree, drawn flat (x and y; z is depth into the screen), filling its pane. */
export function TreeView({ skeleton, fitTo, reveal, selected, hover, onHover, dimmed }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const fit = useRef<Fit | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvas.current!;
    const dpr = devicePixelRatio;
    c.width = Math.round(size.width * dpr);
    c.height = Math.round(size.height * dpr);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    if (size.width === 0) return;
    fit.current = drawSkeleton(ctx, skeleton, { width: size.width, height: size.height, pad: 24, fitTo: fitTo.nodes, reveal, selected, hover });
  }, [skeleton, fitTo, reveal, selected, hover, size]);

  const move = (e: React.PointerEvent) => {
    if (!fit.current) return;
    const r = canvas.current!.getBoundingClientRect();
    const n = pick(skeleton, fit.current, e.clientX - r.left, e.clientY - r.top, 8, reveal);
    onHover(n && n.module !== undefined ? { stage: n.stage, module: n.module, bud: n.bud } : null);
  };

  return (
    <div ref={wrap} className={dimmed ? 'fd-tree fd-tree--dimmed' : 'fd-tree'}>
      <canvas ref={canvas} className="fd-tree-canvas" onPointerMove={move} onPointerLeave={() => onHover(null)} />
    </div>
  );
}
