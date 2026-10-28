import type { Skeleton } from 'fiddy';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Reveal } from './draw';
import { DEFAULT_LOOK, downloadGlb, type Look, treeMeshes } from './meshes';
import { revealed } from './revealed';
import { TreeScene } from './scene3d';
import './TreeView3D.css';

interface Props {
  skeleton: Skeleton;
  /** The finished skeleton: what the camera frames and what an export writes. */
  fitTo: Skeleton;
  reveal: Reveal;
  /** Names the exported file. */
  name: string;
  dimmed?: boolean;
}

/** The tree in 3D, as tubes and leaves, orbited with the mouse; exports as glTF. */
export function TreeView3D({ skeleton, fitTo, reveal, name, dimmed }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<TreeScene | null>(null);
  const [look, setLook] = useState<Look>(DEFAULT_LOOK);
  const [triangles, setTriangles] = useState(0);

  useEffect(() => {
    const s = new TreeScene(canvas.current!);
    scene.current = s;
    const el = wrap.current!;
    const ro = new ResizeObserver(() => s.setSize(el.clientWidth, el.clientHeight));
    ro.observe(el);
    return () => {
      ro.disconnect();
      s.dispose();
      scene.current = null;
    };
  }, []);

  const shown = useMemo(() => revealed(skeleton, reveal), [skeleton, reveal]);
  useEffect(() => scene.current?.frame(fitTo.nodes), [fitTo]);
  useEffect(() => {
    const { bark, leaves } = treeMeshes(shown, fitTo, look);
    scene.current?.setTree(bark, leaves);
    setTriangles((bark.indices.length + leaves.indices.length) / 3);
  }, [shown, fitTo, look]);

  return (
    <div ref={wrap} className={dimmed ? 'fd-tree3d fd-tree3d--dimmed' : 'fd-tree3d'} data-triangles={triangles}>
      <canvas ref={canvas} className="fd-tree3d-canvas" />
      <div className="fd-tree3d-bar">
        <label>
          <span>Leaves</span>
          <input type="range" min={0} max={0.08} step={0.005} value={look.leaf} onChange={(e) => setLook({ ...look, leaf: Number(e.target.value) })} />
        </label>
        <button type="button" onClick={() => scene.current?.frame(fitTo.nodes, true)}>
          Fit
        </button>
        <button type="button" onClick={() => downloadGlb(fitTo, look, name)}>
          Export glTF
        </button>
      </div>
    </div>
  );
}
