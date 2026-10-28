import { EffectEditor, type EffectRun } from '@weasel-js/diagram/effect';
import type { Design, StageResult } from 'fiddy';
import { useEffect, useMemo, useRef } from 'react';
import { GROUND } from '../colors';
import { designDoc, stagesAfter } from './doc';
import { closeRun, PREVIEW, runOf } from './run';
import './Pipeline.css';

// Kept steady across renders: a new options object lays the chart out again.
const OPTIONS = { direction: 'down', showPreviews: true, showValues: true, previewSize: PREVIEW } as const;
const BACKGROUND = { color: GROUND };

interface Props {
  design: Design;
  steps: readonly StageResult[];
  selected: string | null;
  onSelect: (stage: string) => void;
  onStages: (stages: Design['stages'], label: string) => void;
}

/** The stack as a vertical rack: each stage a box with the tree as it stands after it, zoomed to
 *  fill the sidebar and panning no further than the rack. Drag a stage to reorder, Delete to
 *  remove. */
export function Pipeline({ design, steps, selected, onSelect, onStages }: Props) {
  const doc = useMemo(() => designDoc(design), [design]);
  const run = useMemo(() => runOf(design, steps), [design, steps]);
  // Closed once the next run is on screen, not on cleanup: StrictMode's rehearsal of the effect
  // would close the bitmaps still being drawn.
  const shown = useRef<EffectRun | null>(null);
  useEffect(() => {
    if (shown.current && shown.current !== run) closeRun(shown.current);
    shown.current = run;
  }, [run]);

  return (
    <div className="fd-pipeline">
      <EffectEditor
        doc={doc}
        run={run}
        look="rack"
        options={OPTIONS}
        background={BACKGROUND}
        maxScale={4}
        bounded
        refit="always"
        selected={selected}
        onSelect={(id) => id && onSelect(id)}
        onChange={(next, label) => {
          const stages = stagesAfter(next, design);
          if (stages && stages.length > 0) onStages(stages, label);
        }}
      />
    </div>
  );
}
