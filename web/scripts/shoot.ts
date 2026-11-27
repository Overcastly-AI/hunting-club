// Browser checks and screenshots of the admin over sample data (the dev-only demo, src/demo),
// served from the kit build with the real security headers (infra/src/security-headers.ts).
// For every page at 1280 and 390 px wide, in the dark and daylight themes, it checks:
// no Content-Security-Policy violation, no horizontal scroll, axe with no serious or critical
// issue, and that the invite dialog keeps focus inside. Screenshots (deviceScaleFactor 1) go to
// docs/redesign/m2/. Uses the preinstalled Playwright (never `playwright install`).
//
//   npm run build:kit -w @huntclub/web
//   cd web && NODE_PATH=/opt/node-tools/node_modules node ../scripts/run-ts.mjs scripts/shoot.ts
import { THEME_STORAGE_KEY } from '@huntclub/design';
import { ADMIN_PATH } from '@huntclub/shared/app';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, resolve } from 'node:path';
import { contentSecurityPolicy, PERMISSIONS_POLICY } from '../../infra/src/security-headers';

const WEB = process.cwd();
const DIST = resolve(WEB, 'dist-kit');
const OUT = resolve(WEB, '../docs/redesign/m2');
const WIDTHS = [1280, 390] as const;
const HEIGHT: Record<(typeof WIDTHS)[number], number> = { 1280: 860, 390: 844 };
/** File name word for each stored theme preference. */
const THEMES = { dark: 'dark', light: 'daylight' } as const;

interface Shot {
  name: string;
  scenario: string;
  hash: string;
  /** Runs after the page settles, before the checks (e.g. opens a dialog). */
  act?: (page: Page) => Promise<void>;
  /** Only these widths and themes (default: every one). States beyond the main one are shot once. */
  only?: readonly (readonly [number, keyof typeof THEMES])[];
}

/** The Playwright surface used here (the package is loaded from NODE_PATH at run time). */
interface Page {
  goto(url: string): Promise<unknown>;
  waitForSelector(selector: string): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  evaluate<T>(fn: string | (() => T)): Promise<T>;
  screenshot(options: { path: string; fullPage: boolean }): Promise<unknown>;
  getByRole(role: string, options: { name: string | RegExp }): { click(): Promise<void> };
  keyboard: { press(key: string): Promise<void> };
  close(): Promise<void>;
}

const openInvite = async (page: Page) => {
  await page.getByRole('button', { name: 'Invite members' }).click();
  await page.waitForSelector('.ui-dialog[open] .qr svg');
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
  { name: 'my-club', scenario: 'trial', hash: '#/club' },
  { name: 'roster', scenario: 'trial', hash: '#/roster' },
  { name: 'roster-invite', scenario: 'trial', hash: '#/roster', act: openInvite },
  { name: 'stands', scenario: 'trial', hash: '#/stands' },
  { name: 'harvests', scenario: 'trial', hash: '#/harvests' },
  { name: 'map-packs', scenario: 'trial', hash: '#/maps' },
  { name: 'billing', scenario: 'trial', hash: '#/billing' },
  { name: 'not-found', scenario: 'trial', hash: '#/no-such-page' },
  { name: 'account-menu', scenario: 'active', hash: '#/roster', act: openAccount, only: ONCE_EACH },
  { name: 'billing-active', scenario: 'active', hash: '#/billing', only: ONCE },
  { name: 'billing-ending', scenario: 'ending', hash: '#/billing', only: ONCE },
  { name: 'billing-past-due', scenario: 'pastDue', hash: '#/billing', only: ONCE_EACH },
  { name: 'billing-canceled', scenario: 'canceled', hash: '#/billing', only: ONCE },
  { name: 'billing-none', scenario: 'none', hash: '#/billing', only: ONCE_EACH },
  { name: 'billing-no-plans', scenario: 'noPlans', hash: '#/billing', only: ONCE },
  { name: 'billing-no-club', scenario: 'noClub', hash: '#/billing', only: ONCE },
  { name: 'my-club-no-club', scenario: 'noClub', hash: '#/club', only: ONCE_EACH },
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

/** The kit build under ADMIN_PATH, with the site's real security headers. */
function serve(): Promise<{ server: Server; origin: string }> {
  const csp = contentSecurityPolicy({ name: 'dev' });
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
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
      launch(): Promise<{ newContext(o: object): Promise<Context>; close(): Promise<void> }>;
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
  const { server, origin } = await serve();
  const browser = await playwright.chromium.launch();
  const problems: string[] = [];
  let count = 0;
  try {
    for (const shot of SHOTS) {
      for (const width of WIDTHS) {
        for (const theme of Object.keys(THEMES) as (keyof typeof THEMES)[]) {
          if (shot.only && !shot.only.some(([w, t]) => w === width && t === theme)) continue;
          const context = await browser.newContext({
            viewport: { width, height: HEIGHT[width] },
            deviceScaleFactor: 1,
            reducedMotion: 'reduce',
            // The sample club is in Illinois: its sunrise and sunset read in its own time.
            timezoneId: 'America/Chicago',
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
          await page.waitForSelector('h1');
          await page.waitForTimeout(400);
          if (shot.act) await shot.act(page);
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
          if (shot.act === openInvite) {
            for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
            const inside = await page.evaluate<boolean>(
              "!!document.activeElement && !!document.activeElement.closest('.ui-dialog[open]')",
            );
            if (!inside) problems.push(`${label}: focus left the open dialog`);
            await page.keyboard.press('Escape');
            const back = await page.evaluate<string>(
              "document.querySelector('.ui-dialog[open]') ? 'open' : (document.activeElement && document.activeElement.textContent) || ''",
            );
            if (back !== 'Invite members') problems.push(`${label}: Esc left focus on "${back}"`);
            await shot.act(page);
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
