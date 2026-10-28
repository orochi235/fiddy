// Serves the built lab with `vite preview` on a port of its own, for the scripts that drive it.
import { spawn } from 'node:child_process';

export const PORT = 5299;
export const URL = `http://localhost:${PORT}/`;

/** Starts the preview server and resolves once it answers; `stop()` ends it. */
export async function serve() {
  const child = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: new globalThis.URL('../apps/lab/', import.meta.url).pathname, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(URL)).ok) return { stop: () => child.kill() };
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill();
  throw new Error(`the preview server never answered on ${URL}`);
}

/** The presets the lab offers, by name. */
export const presetNames = (page) => page.$$eval('.fd-preset select option', (os) => os.map((o) => o.value).filter(Boolean));

/** Picks a preset from the lab's preset menu and waits for the tree to redraw. */
export async function choosePreset(page, name) {
  await page.selectOption('.fd-preset select', name);
  await page.waitForTimeout(300);
}

/** The fraction of the tree canvas's pixels that are drawn on. */
export const inked = (page) =>
  page.evaluate(() => {
    const c = document.querySelector('.fd-tree-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n / (c.width * c.height);
  });

/** Switches the tree pane to its 2D or 3D view. */
export async function chooseView(page, view) {
  await page.click(`.fd-views button:text-is("${view}")`);
  if (view === '3D') await page.waitForSelector('.fd-tree3d');
}

/** How many triangles the 3D view is drawing. */
export const triangles = (page) => page.$eval('.fd-tree3d', (el) => Number(el.dataset.triangles));
