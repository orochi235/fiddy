import { existsSync, readdirSync, realpathSync, watch } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';

/**
 * `WEASEL=~/src/weasel npm run dev` serves `@weasel-js/*` from that checkout's built `dist`
 * instead of the exact version npm installed. Each import resolves from the checkout's root, so
 * its own workspace links answer it and every package's `exports` and subpaths still apply.
 * A `file:` dependency on a checkout's package selects that checkout without the variable.
 */
export const WEASEL = process.env.WEASEL ? resolve(process.env.WEASEL) : linkedCheckout();

function linkedCheckout(): string | undefined {
  // npm installs it at the root or under the lab, whichever its hoisting picks that day.
  const at = ['node_modules', '../../node_modules'].map((dir) => join(import.meta.dirname, dir, '@weasel-js/labkit')).find(existsSync);
  if (!at) return undefined;
  const labkit = realpathSync(at);
  return labkit.includes('/node_modules/') ? undefined : resolve(labkit, '../..');
}

const packagesOf = (checkout: string): string[] => readdirSync(join(checkout, 'packages'));

/** A file a package's build wrote, by its path under `packages/`. */
const IN_DIST = /^[^/]+\/dist\//;
/** How long a checkout's `dist` files stay unwritten before its build is taken as done. */
const BUILD_QUIET_MS = 1500;

export function weaselCheckout(): Plugin {
  return {
    name: 'fiddy-weasel-checkout',
    enforce: 'pre',
    config() {
      if (!WEASEL) return;
      // Prebundled, a checkout's build would be frozen at startup; the exclusion also changes
      // the config hash, so vite cannot reuse bundles it made from npm's copy.
      const exclude = packagesOf(WEASEL).map((dir) => `@weasel-js/${dir}`);
      return { optimizeDeps: { exclude } };
    },
    configureServer(server) {
      if (!WEASEL) return;
      // Vite watches each file it served, which a rebuild deletes and writes anew, so the new
      // file goes unseen and the old module is served on. A watch on each `dist` saw the first
      // rebuild and none after: the build removes the directory, and the watch with it. One
      // from above them outlives that, and sees a package added since the server started.
      let settled: ReturnType<typeof setTimeout> | null = null;
      const rebuilt = watch(join(WEASEL, 'packages'), { recursive: true }, (_event, name) => {
        if (!name || !IN_DIST.test(name)) return;
        if (settled) clearTimeout(settled);
        settled = setTimeout(() => {
          server.moduleGraph.invalidateAll();
          server.hot.send({ type: 'full-reload' });
        }, BUILD_QUIET_MS);
      });
      server.httpServer?.once('close', () => rebuilt.close());
    },
    resolveId(source) {
      if (!WEASEL || !source.startsWith('@weasel-js/')) return null;
      return this.resolve(source, join(WEASEL, 'package.json'), { skipSelf: true });
    },
  };
}
