#!/usr/bin/env node
// Loads the built lab headless, picks every preset, and fails on any console error or a preset
// whose tree draws nothing. `npm run smoke` bundles the lab first.

import { chromium } from 'playwright-core';
import { choosePreset, inked, presetNames, serve, URL } from './serve.mjs';

const server = await serve();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
let failed = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL);
  await page.waitForSelector('.fd-tree-canvas');
  const names = await presetNames(page);
  for (const [i, name] of names.entries()) {
    await choosePreset(page, name);
    const ink = await inked(page);
    const ok = ink > 0.0005 && errors.length === 0;
    if (!ok) failed++;
    console.log(`${i + 1}/${names.length} ${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(12)} ink ${(ink * 100).toFixed(2).padStart(5)}%${errors.length ? `  ${errors.splice(0).join(' | ')}` : ''}`);
  }
} finally {
  await browser.close();
  server.stop();
}
process.exit(failed ? 1 : 0);
