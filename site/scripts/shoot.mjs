// Screenshots of the built site (site/dist) for review, and real-browser checks: no page
// scrolls sideways from a 360 px phone to the widest screen the hero covers (1920 px), the
// home map hero is full-bleed and its words are at map text size or more, the content
// column is 1120 px on wide screens, and the phone menu opens as a sheet under a 64 px
// header. Widths and sizes come from the site's own source (loaded with Vite), never
// retyped. Uses the Playwright already on the machine (never installs a browser):
//   npm run build -w @huntclub/site
//   NODE_PATH=/opt/node-tools/node_modules node site/scripts/shoot.mjs docs/redesign/m4
// Writes <page>-<width>-<dark|daylight>.png at deviceScaleFactor 1 (home at 390, 1280, 1440
// and 1920; pricing and /join at 1280 and 390), and home-390-menu-<theme>.png with the
// menu open.
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = async (file) => (await runnerImport(join(SITE, 'src', file))).module;
const { MAP_COVERED_WIDTH } = await source('map/mapCss.ts');
const { CONTENT_MAX_WIDTH, NARROWEST_PHONE } = await source('styles.ts');
const { MENU_OPEN_CLASS, MENU_SHEET_ID, MENU_TOGGLE_CLASS, PHONE_HEADER_HEIGHT } =
  await source('menu/menu.ts');
const { fontSize } = (await runnerImport(join(SITE, '..', 'packages/design/src/type.ts'))).module;

const DIST = join(SITE, 'dist');
const OUT = resolve(process.argv[2] ?? 'docs/redesign/m4');
const PHONE = 390;
const SHOTS = {
  home: { path: '/', widths: [PHONE, 1280, 1440, MAP_COVERED_WIDTH] },
  pricing: { path: '/pricing', widths: [1280, PHONE] },
  join: { path: '/join', widths: [1280, PHONE] },
};
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
const THEMES = { dark: 'dark', daylight: 'light' };
// Widths checked for sideways scroll, and (on the home page) for a full-bleed map hero.
const CHECK_WIDTHS = [NARROWEST_PHONE, 1024, 1280, 1440, 1600, MAP_COVERED_WIDTH];
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
const open = async (path, width, colorScheme, height = 900) => {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
    colorScheme,
  });
  await page.goto(origin + path, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return page;
};

/** The phone menu: one 64 px header row; the sheet opens fixed under it and locks the page. */
async function checkMenu(page, theme) {
  const read = () =>
    page.evaluate(
      ([sheetId, openClass]) => {
        const header = document.querySelector('.site-header').getBoundingClientRect();
        const sheet = document.getElementById(sheetId);
        const box = sheet.getBoundingClientRect();
        return {
          header: header.height,
          sheetShown: getComputedStyle(sheet).display !== 'none',
          sheetTop: box.top,
          sheetWidth: box.width,
          locked:
            document.documentElement.classList.contains(openClass) &&
            getComputedStyle(document.body).overflow === 'hidden',
        };
      },
      [MENU_SHEET_ID, MENU_OPEN_CLASS],
    );
  const toggle = page.locator(`.${MENU_TOGGLE_CLASS}`);
  const closed = await read();
  if (closed.header !== PHONE_HEADER_HEIGHT || closed.sheetShown || closed.locked)
    failures.push(`Menu closed (${theme}): ${JSON.stringify(closed)}`);
  await toggle.click();
  const opened = await read();
  const width = page.viewportSize().width;
  if (
    opened.header !== PHONE_HEADER_HEIGHT ||
    !opened.sheetShown ||
    opened.sheetTop !== PHONE_HEADER_HEIGHT ||
    opened.sheetWidth !== width ||
    !opened.locked ||
    (await toggle.getAttribute('aria-expanded')) !== 'true'
  )
    failures.push(`Menu open (${theme}): ${JSON.stringify(opened)}`);
  return async () => {
    await page.keyboard.press('Escape');
    const after = await read();
    if (after.sheetShown || after.locked)
      failures.push(`Menu after Escape (${theme}): ${JSON.stringify(after)}`);
  };
}

try {
  for (const [theme, colorScheme] of Object.entries(THEMES)) {
    for (const [name, { path, widths }] of Object.entries(SHOTS)) {
      for (const width of widths) {
        const page = await open(path, width, colorScheme);
        const file = join(OUT, `${name}-${width}-${theme}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log(file);
        if (name === 'home' && width === PHONE) {
          await page.evaluate(() => scrollTo(0, 0));
          const closeWithEscape = await checkMenu(page, theme);
          const menuFile = join(OUT, `home-${PHONE}-menu-${theme}.png`);
          await page.screenshot({ path: menuFile });
          console.log(menuFile);
          await closeWithEscape();
        }
        await page.close();
      }
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
      // The home hero fills the window edge to edge, and its aerial reaches both edges; every
      // word on it is at map text size or more; the content column is at most 1120 px.
      await check.goto(origin + '/', { waitUntil: 'networkidle' });
      const home = await check.evaluate(() => {
        const hero = document.querySelector('.hero').getBoundingClientRect();
        const map = document.querySelector('.hero .world-map').getBoundingClientRect();
        const words = [...document.querySelectorAll('.hero *')]
          .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
          .map((el) => [
            el.textContent.trim().slice(0, 24),
            parseFloat(getComputedStyle(el).fontSize),
          ]);
        const wrap = document.querySelector('main .wrap');
        const column = wrap.clientWidth - parseFloat(getComputedStyle(wrap).paddingLeft) * 2;
        return {
          gap: {
            left: Math.max(hero.left, map.left - hero.left),
            right: Math.max(innerWidth - hero.right, hero.right - map.right),
          },
          words,
          column,
        };
      });
      if (home.gap.left > 0 || home.gap.right > 0)
        failures.push(
          `The home map hero leaves a gap (${JSON.stringify(home.gap)}) at ${checkWidth}px (${theme})`,
        );
      const small = home.words.filter(([, size]) => !(size >= fontSize.mapLabelMin));
      if (home.words.length === 0 || small.length > 0)
        failures.push(
          `Hero text under ${fontSize.mapLabelMin}px at ${checkWidth}px: ${JSON.stringify(small)}`,
        );
      if (home.column > CONTENT_MAX_WIDTH)
        failures.push(`The content column is ${home.column}px at ${checkWidth}px`);
      await check.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
if (failures.length) {
  console.error(`Failed:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(
  `No page scrolls sideways; the home map hero is full-bleed with map text of ${fontSize.mapLabelMin}px or more, and the content column at most ${CONTENT_MAX_WIDTH}px, at ${CHECK_WIDTHS.join(', ')}px. The phone menu opens and closes.`,
);
