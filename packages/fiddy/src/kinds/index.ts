import type { ParamValue, Stage } from '../design.js';
import { light } from './light.js';
import { lsystem } from './lsystem.js';
import { seed } from './seed.js';
import type { StageKind } from './types.js';

export const KINDS: Readonly<Record<string, StageKind>> = { seed, lsystem, light };

export function kindOf(kind: string): StageKind {
  const k = KINDS[kind];
  if (!k) throw new Error(`no stage kind "${kind}"`);
  return k;
}

/** A stage's params over its kind's defaults. */
export function paramsOf(stage: Stage): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const spec of kindOf(stage.kind).params) out[spec.key] = stage.params[spec.key] ?? spec.default;
  return out;
}
