import { useTrialId, useTrialState } from '@weasel-js/labkit';
import { restack, type Stage } from 'fiddy';
import { useCallback, useRef } from 'react';
import type { LabState } from './state';

/** A trial's state: what the URL holds. Every change to it is an edit undo can step back over. */
export type FiddyState = LabState;

type SetState = (next: FiddyState | ((prev: FiddyState) => FiddyState)) => void;

/** The event that marks an undo step: labkit snapshots the state on it. */
export const EDIT = 'fiddy.edit';

/** Edits closer together than this are one undo step, so a slider drag undoes as a whole. */
const GESTURE_GAP_MS = 500;

const emits = new Map<string, (event: string) => void>();
const lastEdit = new Map<string, number>();

/** Where a trial's edits announce themselves, from its render context. */
export function bindEdits(trialId: string, emit: (event: string) => void) {
  emits.set(trialId, emit);
}

/** The trial's state, with a setter whose identity holds across renders. The first change after
 *  a pause opens an undo step. */
export function useFiddy(): { state: FiddyState; setState: SetState } {
  const id = useTrialId();
  const handle = useTrialState<FiddyState>();
  const latest = useRef(handle.setState);
  latest.current = handle.setState;
  const setState = useCallback<SetState>(
    (next) => {
      const now = performance.now();
      if (now - (lastEdit.get(id) ?? -Infinity) > GESTURE_GAP_MS) emits.get(id)?.(EDIT);
      lastEdit.set(id, now);
      latest.current(next);
    },
    [id],
  );
  return { state: handle.state, setState };
}

/** `s` with its stages replaced, rewired as a stack. Any edit leaves the preset behind. */
export const withStages = (s: FiddyState, stages: readonly Stage[]): FiddyState => ({
  preset: '',
  design: { ...s.design, stages: restack(stages) },
});

/** `s` with one stage changed by `fn`. */
export const editStage = (s: FiddyState, id: string, fn: (stage: Stage) => Stage): FiddyState =>
  withStages(s, s.design.stages.map((st) => (st.id === id ? fn(st) : st)));
