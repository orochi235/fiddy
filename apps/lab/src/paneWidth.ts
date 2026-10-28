import { useState } from 'react';

const KEY = 'fiddy.pane.';

function stored(name: string): number | null {
  try {
    const v = Number(localStorage.getItem(KEY + name));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

/** A sidebar's width, live while dragged and remembered in this browser once the drag ends. */
export function usePaneWidth(name: string, initial: number) {
  const [width, setWidth] = useState(() => stored(name) ?? initial);
  const save = (w: number) => {
    setWidth(w);
    try {
      localStorage.setItem(KEY + name, String(w));
    } catch {}
  };
  return { width, setWidth, save };
}
