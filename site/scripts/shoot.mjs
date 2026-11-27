// Screenshots of the built site (site/dist) for review, and a real-browser check that no page
// scrolls sideways from a 360 px phone to 1600 px, and that the home map hero is full-bleed. Uses the Playwright already on the machine (never
// installs a browser):
//   npm run build -w @huntclub/site
//   NODE_PATH=/opt/node-tools/node_modules node site/scripts/shoot.mjs docs/redesign/m4
// Writes <page>-<1280|390>-<dark|daylight>.png at deviceScaleFactor 1.
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const OUT = resolve(process.argv[2] ?? 'docs/redesign/m4');
const SHOTS = { home: '/', pricing: '/pricing', join: '/join' };
const PAGES = [
  '/',
  '/features',
  '/clubs',
  '/pricing',
  '/download',
  '/faq',
  '/contact',
  '/privacy',
  '/terms',
  '/join',
  '/404.html',
];
const WIDTHS = [1280, 390];
const THEMES = { dark: 'dark', daylight: 'light' };
const NARROWEST = 360;
// Widths checked for sideways scroll, and (on the home page) for a full-bleed map hero.
const CHECK_WIDTHS = [NARROWEST, 1024, 1280, 1440, 1600];
const TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = join(DIST, path);
  if (!extname(path)) file = join(DIST, path, 'index.html');
  if (!file.startsWith(DIST) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, ok));
const origin = `http://localhost:${server.address().port}`;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const failures = [];
try {
  for (const [theme, colorScheme] of Object.entries(THEMES)) {
    for (const width of WIDTHS) {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        deviceScaleFactor: 1,
        colorScheme,
      });
      for (const [name, path] of Object.entries(SHOTS)) {
        await page.goto(origin + path, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        const file = join(OUT, `${name}-${width}-${theme}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log(file);
      }
      await page.close();
    }
    for (const checkWidth of CHECK_WIDTHS) {
      const check = await browser.newPage({
        viewport: { width: checkWidth, height: 800 },
        deviceScaleFactor: 1,
        colorScheme,
      });
      for (const path of PAGES) {
        await check.goto(origin + path, { waitUntil: 'networkidle' });
        const wide = await check.evaluate(() => document.documentElement.scrollWidth);
        if (wide > checkWidth)
          failures.push(`${path} (${theme}) is ${wide}px wide at ${checkWidth}px`);
      }
      // The home hero fills the window edge to edge, and its aerial reaches both edges.
      await check.goto(origin + '/', { waitUntil: 'networkidle' });
      const gap = await check.evaluate(() => {
        const hero = document.querySelector('.hero').getBoundingClientRect();
        const map = document.querySelector('.hero .world-map').getBoundingClientRect();
        return {
          left: Math.max(hero.left, map.left - hero.left),
          right: Math.max(innerWidth - hero.right, hero.right - map.right),
        };
      });
      if (gap.left > 0 || gap.right > 0)
        failures.push(
          `The home map hero leaves a gap (${JSON.stringify(gap)}) at ${checkWidth}px (${theme})`,
        );
      await check.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
if (failures.length) {
  console.error(`Sideways scroll:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(
  `No page scrolls sideways, and the home map hero is full-bleed, at ${CHECK_WIDTHS.join(', ')}px.`,
);
