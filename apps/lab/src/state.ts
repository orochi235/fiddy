import { type Design, PRESETS, sanitizeDesign } from 'fiddy';

export interface LabState {
  /** The preset the design started from, by name; '' once nothing matches. */
  preset: string;
  design: Design;
}

export function presetState(name: string): LabState {
  const p = PRESETS.find((x) => x.name === name) ?? PRESETS[0]!;
  return { preset: p.name, design: p.design() };
}

export const initialState = (): LabState => readHash() ?? presetState('Fig. 1.24d');

const encode = (value: unknown): string => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const decode = (text: string): unknown => {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
};

/** The whole lab as a URL hash, so any state is a link. */
export function writeHash(s: LabState): void {
  history.replaceState(null, '', `#s=${encode({ preset: s.preset, design: s.design })}`);
}

function readHash(): LabState | null {
  const m = location.hash.match(/^#s=([A-Za-z0-9_-]+)$/);
  if (!m) return null;
  try {
    const raw = decode(m[1]!) as { preset?: unknown; design?: unknown };
    const design = sanitizeDesign(raw.design);
    return design ? { preset: typeof raw.preset === 'string' ? raw.preset : '', design } : null;
  } catch {
    return null;
  }
}
