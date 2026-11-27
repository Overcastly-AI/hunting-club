// Screenshots every direction mockup, dark and daylight, at deviceScaleFactor 2.
// Run from the repo root, after build.mjs:  node docs/redesign/directions/tools/shoot.mjs [direction]
// Uses the preinstalled Playwright (NODE_PATH must reach it); never downloads a browser.
import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const directions = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** page file, output name, viewport, and whether to capture the whole page. The map goes first: the site's home page shows its phone shot. */
const SHOTS = [
  { page: 'map.html', name: 'map', width: 900, height: 940, full: true, element: { selector: '#phone', name: 'map-phone' } },
  { page: 'signin.html', name: 'signin-1280', width: 1280, height: 800 },
  { page: 'club.html', name: 'club-1280', width: 1280, height: 800, full: true },
  { page: 'club.html', name: 'club-390', width: 390, height: 844, full: true },
  { page: 'home.html', name: 'home-1280', width: 1280, height: 800, full: true },
  { page: 'home.html', name: 'home-390', width: 390, height: 844, full: true },
  { page: 'pricing.html', name: 'pricing-1280', width: 1280, height: 800, full: true },
  { page: 'pricing.html', name: 'pricing-390', width: 390, height: 844, full: true },
];
const THEMES = ['dark', 'daylight'];

const only = process.argv[2];
const browser = await chromium.launch();
for (const dir of readdirSync(directions, { withFileTypes: true })) {
  if (!dir.isDirectory() || dir.name === 'tools' || (only && dir.name !== only)) continue;
  for (const shot of SHOTS) {
    const file = join(directions, dir.name, shot.page);
    if (!existsSync(file)) continue;
    for (const theme of THEMES) {
      const context = await browser.newContext({
        viewport: { width: shot.width, height: shot.height },
        deviceScaleFactor: 2,
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      await page.goto(pathToFileURL(file).href);
      await page.evaluate((t) => {
        if (t === 'daylight') document.documentElement.dataset.theme = t;
      }, theme);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState('networkidle');
      const out = (name) => join(directions, dir.name, `${name}-${theme}.png`);
      if (shot.element) await page.locator(shot.element.selector).screenshot({ path: out(shot.element.name) });
      await page.screenshot({ path: out(shot.name), fullPage: Boolean(shot.full) });
      await context.close();
      console.log(`${dir.name}/${shot.name}-${theme}.png`);
    }
  }
}
await browser.close();
