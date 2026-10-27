#!/usr/bin/env node
// Screenshots each preset's tree and posts it to the transom wall, in the repo's zone. The files are
// written to a temporary directory that is removed on the way out. `npm run shots` bundles first.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { choosePreset, presetNames, serve, URL } from './serve.mjs';

const transom = existsSync(join(homedir(), 'src/transom/bin/transom')) ? join(homedir(), 'src/transom/bin/transom') : 'transom';
const dir = mkdtempSync(join(tmpdir(), 'fiddy-shots-'));
const server = await serve();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 2 });
  await page.goto(URL);
  await page.waitForSelector('.fd-tree-canvas');
  const names = await presetNames(page);
  for (const [i, name] of names.entries()) {
    await choosePreset(page, name);
    const file = join(dir, `${name.replace(/[^\w.-]+/g, '-')}.png`);
    await page.locator('.fd-tree').screenshot({ path: file });
    const posted = spawnSync(transom, ['post', file], { encoding: 'utf8' });
    const wall = `${posted.stdout}${posted.stderr}`.match(/wall: (\S+)/)?.[1] ?? `not posted: ${posted.stderr.trim()}`;
    console.log(`${i + 1}/${names.length} ${name.padEnd(12)} ${wall}`);
  }
} finally {
  await browser.close();
  server.stop();
  rmSync(dir, { recursive: true, force: true });
}
