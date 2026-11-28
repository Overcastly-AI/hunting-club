// Screenshots of the built site (site/dist) for review, and real-browser checks: no page
// scrolls sideways from a 360 px phone to the widest screen the hero covers (1920 px), the
// home map hero is full-bleed and its words are at map text size or more, the content
// column is 1120 px on wide screens, and the phone menu opens as a sheet under a 64 px
// header. On the phones of the iPhone audit (PHONE_VIEWPORTS: SE and iPhone 15 upright, iPhone
// 15 and Pro Max on their side) no word on any page starts inside the 16 px phone gutter and no
// label or plate on the home map is cut by the window's edge. Pages are served with the real
// Content-Security-Policy (infra/src/security-headers.ts), and any violation fails the run, in
// Chromium and, where Playwright has it, WebKit. Widths and sizes come from the site's own
// source (loaded with Vite), never retyped. Uses the Playwright already on the machine (never
// installs a browser):
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
const { chromium, webkit } = require('playwright');

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = async (file) => (await runnerImport(join(SITE, 'src', file))).module;
const { MAP_COVERED_WIDTH } = await source('map/mapCss.ts');
const { CONTENT_MAX_WIDTH, GUTTER, NARROWEST_PHONE } = await source('styles.ts');
const { MENU_OPEN_CLASS, MENU_SHEET_ID, MENU_TOGGLE_CLASS, PHONE_HEADER_HEIGHT } =
  await source('menu/menu.ts');
const { fontSize } = (await runnerImport(join(SITE, '..', 'packages/design/src/type.ts'))).module;
const { PHONE_VIEWPORTS } = (await runnerImport(join(SITE, '..', 'packages/design/src/phones.ts')))
  .module;
const { contentSecurityPolicy } = (
  await runnerImport(join(SITE, '..', 'infra/src/security-headers.ts'))
).module;
const CSP = contentSecurityPolicy({ name: 'dev' });

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
const CHECK_WIDTHS = [NARROWEST_PHONE, PHONE, 600, 768, 1024, 1280, 1440, 1600, MAP_COVERED_WIDTH];
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
  res.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'content-security-policy': CSP,
  });
  createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, ok));
const origin = `http://localhost:${server.address().port}`;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const failures = [];
/** Records every CSP violation a page reports (read back with `cspSeen`). */
const CSP_WATCH = `window.__csp = []; document.addEventListener('securitypolicyviolation',
  (e) => window.__csp.push(e.violatedDirective + ' ' + (e.blockedURI || 'inline')));`;
const cspSeen = (page) => page.evaluate(() => window.__csp ?? []);
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
        // Every marker (its shape and plate) and the scale bar, where they show in the map
        // window, must stay clear of the plates floating over it (the pitch, the readout strip).
        // On a phone the pitch is a sheet under the map, not over it: the window ends at its top.
        const box = (r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
        const pitch = document.querySelector('.hero .pitch');
        const sheet = getComputedStyle(pitch).position !== 'absolute';
        const windowBottom = sheet ? pitch.getBoundingClientRect().top : hero.bottom;
        const clip = (r) => ({
          left: Math.max(r.left, hero.left),
          top: Math.max(r.top, hero.top),
          right: Math.min(r.right, hero.right),
          bottom: Math.min(r.bottom, windowBottom),
        });
        const meets = (a, b) =>
          a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        const plates = [...document.querySelectorAll('.hero > .plate')]
          .filter((el) => !(sheet && el === pitch))
          .map((el) => ({
            name: el.className,
            ...box(el.getBoundingClientRect()),
          }));
        const marks = [
          ...[...document.querySelectorAll('.hero .world .mk')].map((mk) => ({
            name: mk.textContent.trim() || mk.className,
            parts: [...mk.querySelectorAll('.dot, .sq, .tag')],
          })),
          { name: 'scale bar', parts: [document.querySelector('.hero .scale')] },
        ];
        const covered = [];
        for (const mark of marks) {
          for (const part of mark.parts) {
            const r = part.getBoundingClientRect();
            if (getComputedStyle(part).display === 'none' || r.width === 0) continue;
            const seen = clip(box(r));
            if (seen.right <= seen.left || seen.bottom <= seen.top) continue;
            for (const plate of plates)
              if (meets(seen, plate)) covered.push(`${mark.name} under ${plate.name}`);
          }
        }
        const wrap = document.querySelector('main .wrap');
        const column = wrap.clientWidth - parseFloat(getComputedStyle(wrap).paddingLeft) * 2;
        return {
          gap: {
            left: Math.max(hero.left, map.left - hero.left),
            right: Math.max(innerWidth - hero.right, hero.right - map.right),
          },
          words,
          covered: [...new Set(covered)],
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
      if (home.covered.length)
        failures.push(`Covered at ${checkWidth}px (${theme}): ${home.covered.join('; ')}`);
      if (home.column > CONTENT_MAX_WIDTH)
        failures.push(`The content column is ${home.column}px at ${checkWidth}px`);
      await check.close();
    }
  }
  // The phones of the iPhone audit: words clear of the 16 px gutter, the hero's labels whole,
  // and no CSP violation, in Chromium and (where it is installed) WebKit.
  const engines = [['Chromium', browser]];
  try {
    engines.push(['WebKit', await webkit.launch()]);
  } catch {
    console.log('WebKit is not installed here: the CSP check runs in Chromium only.');
  }
  for (const [engine, b] of engines) {
    for (const phone of Object.values(PHONE_VIEWPORTS)) {
      const context = await b.newContext({
        viewport: { width: phone.width, height: phone.height },
        deviceScaleFactor: 1,
        hasTouch: true,
        ...(engine === 'Chromium' ? { isMobile: true } : {}),
      });
      await context.addInitScript(CSP_WATCH);
      const page = await context.newPage();
      for (const path of PAGES) {
        await page.goto(origin + path, { waitUntil: 'networkidle' });
        for (const v of await cspSeen(page))
          failures.push(`${engine} ${phone.name} ${path}: CSP violation ${v}`);
        if (engine !== 'Chromium') continue;
        // Every element with words of its own starts at the gutter or further in (the full-bleed
        // map hero and the header bar's own 12 px edge are their own layouts).
        const early = await page.evaluate((gutter) => {
          const out = [];
          for (const el of document.querySelectorAll('main *, footer *')) {
            if (el.closest('.hero, .mapview, .sym')) continue;
            const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
            if (!own) continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden')
              continue;
            if (el.closest('.sr-only')) continue;
            if (r.left < gutter - 0.5)
              out.push(
                `${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 30)}" at ${Math.round(r.left)}px`,
              );
          }
          return out.slice(0, 5);
        }, GUTTER.phone);
        for (const e of early)
          failures.push(`${phone.name} ${path}: ${e}, inside the ${GUTTER.phone}px gutter`);
        if (path !== '/') continue;
        const cut = await page.evaluate(() => {
          const hero = document.querySelector('.hero').getBoundingClientRect();
          return [...document.querySelectorAll('.hero .world .tag, .hero .world .lbl')]
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return (
                r.width > 0 &&
                r.right > hero.left &&
                r.left < hero.right &&
                (r.left < hero.left || r.right > hero.right)
              );
            })
            .map((el) => el.textContent.trim());
        });
        for (const c of cut)
          failures.push(`${phone.name}: the home map's "${c}" is cut by the window's edge`);
      }
      await context.close();
    }
    if (b !== browser) await b.close();
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
  `No CSP violation; on the audit's phones no word sits in the ${GUTTER.phone}px gutter and no label on the home map is cut. No page scrolls sideways; the home map hero is full-bleed with map text of ${fontSize.mapLabelMin}px or more and no marker or scale bar under a plate, and the content column at most ${CONTENT_MAX_WIDTH}px, at ${CHECK_WIDTHS.join(', ')}px. The phone menu opens and closes.`,
);
