import { defineInstrument } from '@weasel-js/labkit';
import { bindEdits, EDIT, type FiddyState } from './session';
import { initialState } from './state';
import { Workspace } from './Workspace';

/** One design and its views. The design opens from the URL hash, which the workspace keeps
 *  current, so the lab persists nothing of its own. */
export const fiddyInstrument = defineInstrument<FiddyState, Record<string, never>>({
  name: 'fiddy',
  defaultConfig: () => ({}),
  initialState,
  undo: { snapshotOn: [EDIT], maxDepth: 100 },
  render: (ctx) => {
    bindEdits(ctx.trial.id, ctx.emit);
    return <Workspace />;
  },
});
