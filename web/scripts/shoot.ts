// Browser checks and screenshots of the admin over sample data (the dev-only demo, src/demo),
// served from the kit build with the real security headers (infra/src/security-headers.ts).
// For every page at 1280 and 390 px wide, in the dark and daylight themes, it checks:
// no Content-Security-Policy violation, no horizontal scroll, axe with no serious or critical
// issue, and that the phone's More sheet takes focus and gives it back to the More tab. Screenshots (deviceScaleFactor 1) go to
// docs/redesign/<folder>/ (m2 unless named), optionally only the named shots. The sample
// property's committed aerial map pack (sample-pack/, built by scripts/sample-pack.ts) is
// served with range requests, as CloudFront serves packs: at the demo club's key (My club)
// and at the public sample key (sign-in).
// My club's live USGS tiles load from the one USGS host the CSP allows (through HTTPS_PROXY when
// set); the shots wait for the network to settle so the tiles are in the picture.
// Uses the preinstalled Playwright (never `playwright install`).
//
//   npm run build:kit -w @huntclub/web
//   cd web && NODE_USE_ENV_PROXY=1 NODE_PATH=/opt/node-tools/node_modules \
//     node ../scripts/run-ts.mjs scripts/shoot.ts [folder] [shot,shot,...]
import { THEME_STORAGE_KEY } from '@huntclub/design';
import { mapPackPath, polygonBounds } from '@huntclub/shared';
import { SAMPLE_PROPERTY } from '@huntclub/shared/sample';
import { ADMIN_PATH } from '@huntclub/shared/app';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, resolve } from 'node:path';
import { contentSecurityPolicy, PERMISSIONS_POLICY } from '../../infra/src/security-headers';
import { SAMPLE_PACK, samplePack } from '../src/map/samplePack';
import { sampleData } from '../src/testing/fakeClubApi';
import { samplePackFile } from './samplePackFile';

const WEB = process.cwd();
const DIST = resolve(WEB, 'dist-kit');
const [FOLDER = 'm2', ONLY_SHOTS] = process.argv.slice(2);
const OUT = resolve(WEB, '../docs/redesign', FOLDER);
const WIDTHS = [1280, 390] as const;
const HEIGHT: Record<(typeof WIDTHS)[number], number> = { 1280: 860, 390: 844 };
/** File name word for each stored theme preference. */
const THEMES = { dark: 'dark', light: 'daylight' } as const;

interface Shot {
  name: string;
  scenario: string;
  hash: string;
  /** What shows once the page is up (default: the page's h1). */
  ready?: string;
  /** Runs after the page settles, before the checks (e.g. opens a dialog). */
  act?: (page: Page) => Promise<void>;
  /** Only these widths and themes (default: every one). States beyond the main one are shot once. */
  only?: readonly (readonly [number, keyof typeof THEMES])[];
  /** Where the browser says it is (granted), for "My location". */
  geolocation?: { latitude: number; longitude: number };
}

/** The Playwright surface used here (the package is loaded from NODE_PATH at run time). */
interface Page {
  goto(url: string): Promise<unknown>;
  waitForLoadState(state: 'networkidle'): Promise<void>;
  mouse: { click(x: number, y: number): Promise<void> };
  waitForSelector(selector: string): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  evaluate<T>(fn: string | (() => T)): Promise<T>;
  screenshot(options: { path: string; fullPage: boolean }): Promise<unknown>;
  getByRole(
    role: string,
    options: { name: string | RegExp },
  ): { click(): Promise<void>; fill(value: string): Promise<void> };
  keyboard: { press(key: string): Promise<void> };
  close(): Promise<void>;
}

const openInvite = async (page: Page) => {
  await page.getByRole('button', { name: 'Create invite link' }).click();
  await page.waitForSelector('.roster__invite .qr svg');
};
/** Sign-in's second step: an email sent, the code field showing. */
const codeStep = async (page: Page) => {
  await page.getByRole('textbox', { name: 'Email address' }).fill('dale@example.com');
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await page.waitForSelector('.signin__code');
};
/** My club with a stand's details open (the side panel; a bottom sheet on phones). */
const openStand = async (page: Page) => {
  await page.getByRole('button', { name: /^Big Oak Ladder,/ }).click();
  await page.waitForSelector('.ui-dialog--side[open] .stand-facts');
  await page.waitForTimeout(250);
};
/** My club with a placed stand open in the stand editor (from its details: Edit stand). */
const editStand = async (page: Page) => {
  await openStand(page);
  await page.getByRole('button', { name: 'Edit stand' }).click();
  await page.waitForSelector('.draw__stand');
};
/** My club with an area open in the area editor (from the Stands and areas list). */
const editArea = async (page: Page) => {
  await page.getByRole('button', { name: 'Edit North 40' }).click();
  await page.waitForSelector('.draw__corner');
};
const openClubSwitcher = async (page: Page) => {
  await page.getByRole('button', { name: /Club:/ }).click();
  await page.waitForTimeout(250);
};
/** The middle of the sample property: where "My location" puts the browser for the draw shot. */
const [west, south, east, north] = polygonBounds(SAMPLE_PROPERTY.boundary);
const AT_THE_PROPERTY = { latitude: (south + north) / 2, longitude: (west + east) / 2 };
/**
 * My club with no property line yet: Draw property line, Find me (the browser is at the
 * property), one level closer, then four corners tapped in the open map between the plate on
 * top and the controls at the bottom.
 */
const drawLine = async (page: Page) => {
  await page.getByRole('button', { name: 'Draw property line' }).click();
  await page.getByRole('button', { name: 'Find me' }).click();
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  const open = await page.evaluate<{ left: number; right: number; top: number; bottom: number }>(
    `(() => {
      const map = document.querySelector('.clubview__map').getBoundingClientRect();
      const plate = document.querySelector('.clubview__plate').getBoundingClientRect();
      const controls = document.querySelector('.plan__controls').getBoundingClientRect();
      // On a phone the draw tools are a bar along the bottom, under the controls.
      return { left: map.left, right: map.right, top: plate.bottom, bottom: controls.top };
    })()`,
  );
  const x = (share: number) => open.left + (open.right - open.left) * share;
  const y = (share: number) => open.top + (open.bottom - open.top) * share;
  for (const [sx, sy] of [
    [0.2, 0.2],
    [0.75, 0.15],
    [0.8, 0.8],
    [0.35, 0.85],
  ] as const)
    await page.mouse.click(x(sx), y(sy));
};
const openAccount = async (page: Page) => {
  await page.getByRole('button', { name: /Account/ }).click();
  await page.waitForTimeout(250);
};

/** Extra states: desktop dark only, or that plus the phone in daylight. */
const ONCE = [[1280, 'dark']] as const;
const ONCE_EACH = [
  [1280, 'dark'],
  [390, 'light'],
] as const;

const SHOTS: readonly Shot[] = [
  { name: 'signin', scenario: 'signedOut', hash: '' },
  { name: 'signin-code', scenario: 'signedOut', hash: '', act: codeStep },
  { name: 'my-club', scenario: 'trial', hash: '#/club' },
  { name: 'my-club-stand', scenario: 'trial', hash: '#/club', act: openStand },
  { name: 'my-club-stand-edit', scenario: 'trial', hash: '#/club', act: editStand },
  { name: 'my-club-area-edit', scenario: 'trial', hash: '#/club', act: editArea },
  { name: 'roster', scenario: 'trial', hash: '#/roster' },
  { name: 'roster-invite', scenario: 'trial', hash: '#/roster', act: openInvite },
  { name: 'roster-empty', scenario: 'alone', hash: '#/roster', only: ONCE_EACH },
  // The club service never answers: the skeletons, past their 200 ms wait.
  { name: 'loading', scenario: 'loading', hash: '#/roster' },
  { name: 'loading-harvests', scenario: 'loading', hash: '#/harvests', only: ONCE_EACH },
  {
    name: 'loading-my-club',
    scenario: 'loading',
    hash: '#/club',
    ready: '.ui-skeleton--map',
    only: ONCE_EACH,
  },
  { name: 'stands', scenario: 'trial', hash: '#/stands' },
  { name: 'harvests', scenario: 'trial', hash: '#/harvests' },
  { name: 'map-packs', scenario: 'trial', hash: '#/maps' },
  { name: 'billing', scenario: 'trial', hash: '#/billing' },
  { name: 'not-found', scenario: 'trial', hash: '#/no-such-page' },
  { name: 'account-menu', scenario: 'active', hash: '#/roster', act: openAccount },
  {
    name: 'club-switcher',
    scenario: 'active',
    hash: '#/roster',
    act: openClubSwitcher,
    only: ONCE,
  },
  { name: 'billing-active', scenario: 'active', hash: '#/billing', only: ONCE },
  { name: 'billing-ending', scenario: 'ending', hash: '#/billing', only: ONCE },
  { name: 'billing-past-due', scenario: 'pastDue', hash: '#/billing', only: ONCE_EACH },
  { name: 'billing-canceled', scenario: 'canceled', hash: '#/billing', only: ONCE },
  { name: 'billing-none', scenario: 'none', hash: '#/billing', only: ONCE_EACH },
  { name: 'billing-no-plans', scenario: 'noPlans', hash: '#/billing', only: ONCE },
  { name: 'billing-no-club', scenario: 'noClub', hash: '#/billing', only: ONCE },
  { name: 'my-club-no-club', scenario: 'noClub', hash: '#/club', only: ONCE_EACH },
  { name: 'my-club-no-line', scenario: 'noLine', hash: '#/club' },
  {
    name: 'my-club-draw-more',
    scenario: 'noLine',
    hash: '#/club',
    act: async (page) => {
      await drawLine(page);
      await page.getByRole('button', { name: 'More tools' }).click();
    },
    geolocation: AT_THE_PROPERTY,
    only: [
      [390, 'dark'],
      [390, 'light'],
    ],
  },
  {
    name: 'my-club-draw',
    scenario: 'noLine',
    hash: '#/club',
    act: drawLine,
    geolocation: AT_THE_PROPERTY,
  },
  { name: 'map-packs-no-line', scenario: 'noLine', hash: '#/maps', only: ONCE_EACH },
];

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.json': 'application/json',
};

/** The kit build under ADMIN_PATH, with the site's real security headers; the sample pack. */
function serve(packArchive: Buffer): Promise<{ server: Server; origin: string }> {
  const csp = contentSecurityPolicy({ name: 'dev' });
  const packPaths = [samplePack(sampleData().club!.id), SAMPLE_PACK].map(mapPackPath);
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (packPaths.includes(url.pathname)) {
      // CloudFront answers a range of an S3 object with 206.
      const [, from, to] = /bytes=(\d+)-(\d+)/.exec(req.headers.range ?? '')?.map(Number) ?? [];
      res.setHeader('Content-Type', 'application/octet-stream');
      if (from === undefined || to === undefined) return void res.end(packArchive);
      const end = Math.min(to, packArchive.length - 1);
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${from}-${end}/${packArchive.length}`);
      return void res.end(packArchive.subarray(from, end + 1));
    }
    let file = url.pathname.startsWith(ADMIN_PATH)
      ? join(DIST, url.pathname.slice(ADMIN_PATH.length))
      : join(DIST, url.pathname);
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader(PERMISSIONS_POLICY.header, PERMISSIONS_POLICY.value);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
    createReadStream(file).pipe(res);
  });
  return new Promise((done) =>
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      done({ server, origin: `http://127.0.0.1:${port}` });
    }),
  );
}

async function main() {
  if (!existsSync(join(DIST, 'index.html')))
    throw new Error('Build the kit first: npm run build:kit');
  mkdirSync(OUT, { recursive: true });
  const load = createRequire(join(WEB, 'package.json'));
  // Loaded by name at run time, from NODE_PATH (the preinstalled copy), never bundled.
  const playwright = load(['play', 'wright'].join('')) as {
    chromium: {
      launch(
        o: object,
      ): Promise<{ newContext(o: object): Promise<Context>; close(): Promise<void> }>;
    };
  };
  interface Context {
    addInitScript(script: string): Promise<void>;
    newPage(): Promise<
      Page & { on(event: string, fn: (m: { text(): string; type(): string }) => void): void }
    >;
    close(): Promise<void>;
  }
  const axeSource = readFileSync(load.resolve('axe-core/axe.min.js'), 'utf8');
  const { server, origin } = await serve(readFileSync(samplePackFile(WEB)));
  const only = ONLY_SHOTS?.split(',');
  // Live USGS tiles go out through the session's proxy when there is one; the demo stays local.
  const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;
  const browser = await playwright.chromium.launch(
    proxy ? { proxy: { server: proxy, bypass: '127.0.0.1,localhost' } } : {},
  );
  const problems: string[] = [];
  let count = 0;
  try {
    for (const shot of SHOTS) {
      if (only && !only.includes(shot.name)) continue;
      for (const width of WIDTHS) {
        for (const theme of Object.keys(THEMES) as (keyof typeof THEMES)[]) {
          if (shot.only && !shot.only.some(([w, t]) => w === width && t === theme)) continue;
          const context = await browser.newContext({
            viewport: { width, height: HEIGHT[width] },
            deviceScaleFactor: 1,
            reducedMotion: 'reduce',
            // The sample club is in Illinois: its sunrise and sunset read in its own time.
            timezoneId: 'America/Chicago',
            ...(shot.geolocation
              ? { geolocation: shot.geolocation, permissions: ['geolocation'] }
              : {}),
          });
          await context.addInitScript(
            `try { localStorage.setItem(${JSON.stringify(THEME_STORAGE_KEY)}, ${JSON.stringify(theme)}); } catch {}
             window.__csp = [];
             document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));`,
          );
          const page = await context.newPage();
          const errors: string[] = [];
          page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
          });
          const label = `${shot.name} ${width} ${THEMES[theme]}`;
          await page.goto(`${origin}${ADMIN_PATH}?demo=${shot.scenario}${shot.hash}`);
          await page.waitForSelector(shot.ready ?? 'h1');
          await page.waitForTimeout(400);
          // My club and sign-in draw the sample pack once the archive is read.
          if (
            (shot.hash === '#/club' && !['noClub', 'loading', 'noLine'].includes(shot.scenario)) ||
            shot.scenario === 'signedOut'
          )
            await page.waitForSelector('.plan__basemap image');
          if (shot.act) await shot.act(page);
          await page.waitForLoadState('networkidle');
          const csp = await page.evaluate<string[]>('window.__csp');
          for (const v of csp) problems.push(`${label}: CSP violation ${v}`);
          for (const e of errors) problems.push(`${label}: console error ${e}`);
          const overflow = await page.evaluate<number>(
            'document.documentElement.scrollWidth - document.documentElement.clientWidth',
          );
          if (overflow > 0) problems.push(`${label}: scrolls sideways by ${overflow}px`);
          await page.evaluate(`${axeSource};0`);
          const axe = await page.evaluate<string[]>(
            `axe.run(document).then((r) => r.violations
               .filter((v) => v.impact === 'serious' || v.impact === 'critical')
               .map((v) => v.id + ' (' + v.impact + '): ' + v.nodes.map((n) => n.target.join(' ')).join(', ')))`,
          );
          for (const a of axe) problems.push(`${label}: axe ${a}`);
          if (shot.name === 'roster' && width === 390) {
            // The More tab: expanded and its sheet holding focus while open, focus back on close.
            await page.getByRole('button', { name: /^More/ }).click();
            await page.waitForSelector('.ui-dialog[open]');
            for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
            const inside = await page.evaluate<boolean>(
              "!!document.activeElement && !!document.activeElement.closest('.ui-dialog[open]')",
            );
            if (!inside) problems.push(`${label}: focus left the More sheet`);
            await page.keyboard.press('Escape');
            const back = await page.evaluate<string>(
              "document.querySelector('.ui-dialog[open]') ? 'open' : (document.activeElement && document.activeElement.getAttribute('aria-expanded')) || ''",
            );
            if (back !== 'false') problems.push(`${label}: Esc did not return focus to More`);
          }
          await page.screenshot({
            path: join(OUT, `${shot.name}-${width}-${THEMES[theme]}.png`),
            fullPage: true,
          });
          count += 1;
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`${count} screenshots in ${OUT}`);
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log('No CSP violations, no sideways scroll, no serious or critical axe issues.');
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
