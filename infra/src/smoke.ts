// Read-only smoke check of a deployed environment: the web page, the universal-link
// files, the club API's auth and CORS, and the Stripe webhook's signature check.
// Every URL comes from the single sources (CLOUD_ENVIRONMENTS, the env config); nothing
// here writes, signs anyone up or sends email.
import { colors } from '@huntclub/design';
import { API_PATHS, CLOUD_ENVIRONMENTS, WEB_PAGE_PATHS } from '@huntclub/shared';
import type { CloudEnvironment } from '@huntclub/shared/cloud';
import type { EnvConfig } from '../config';
import { ROBOTS_FILE, robotsTxt } from './web-pages';
import { wellKnownFiles } from './well-known';

/** The part of fetch the checks use (Node's global fetch fits). */
export type SmokeFetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; redirect?: 'manual' },
) => Promise<{
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

export interface SmokeResult {
  name: string;
  ok: boolean;
  detail: string;
}

/** The universal-link files infra knows about; each is either published or absent. */
const WELL_KNOWN_KEYS = ['.well-known/apple-app-site-association', '.well-known/assetlinks.json'];

/** An origin the club API must not allow (reserved TLD: never a real site). */
const FOREIGN_ORIGIN = 'https://smoke.invalid';

/** A page path no page uses: the SPA fallback must still serve the page (Page not found). */
export const UNKNOWN_PAGE_PATH = '/smoke-unknown-page';

/** Files that do not exist: CloudFront may list the bucket, so each must be a real 404. */
export const MISSING_FILES = ['/assets/smoke-missing.js', '/favicon.ico'];

const isMissing = (status: number) => status === 404;

/** The content of `<meta name="…" content="…">` in the page, as Vite writes it. */
const metaContent = (html: string, name: string) =>
  new RegExp(`<meta name="${name}" content="([^"]*)"`).exec(html)?.[1];

export function cloudFor(config: EnvConfig): CloudEnvironment {
  const cloud = (CLOUD_ENVIRONMENTS as Record<string, CloudEnvironment>)[config.name];
  if (!cloud) throw new Error(`No CLOUD_ENVIRONMENTS entry for "${config.name}"`);
  return cloud;
}

export async function runSmoke(config: EnvConfig, fetch: SmokeFetch): Promise<SmokeResult[]> {
  const cloud = cloudFor(config);
  const site = `https://${config.domainName}`;
  const results: SmokeResult[] = [];
  const check = async (name: string, run: () => Promise<string>) => {
    try {
      results.push({ name, ok: true, detail: await run() });
    } catch (error) {
      results.push({
        name,
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  };
  const expect = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };

  // Web page --------------------------------------------------------------------------
  let index = '';
  await check('site serves index.html', async () => {
    const res = await fetch(`${site}/`);
    index = await res.text();
    expect(res.status === 200, `GET / → ${res.status}`);
    expect(/text\/html/.test(res.headers.get('content-type') ?? ''), 'not text/html');
    expect(index.includes('id="root"'), 'no app root element');
    return 'GET / → 200 text/html';
  });
  let icon = '';
  await check('page head has a title, description, theme color and icon', async () => {
    expect(/<title>[^<]+<\/title>/.test(index), 'no title');
    expect(Boolean(metaContent(index, 'description')), 'no meta description');
    const theme = metaContent(index, 'theme-color');
    expect(theme === colors.surface, `theme-color is ${theme ?? 'missing'}`);
    icon = /<link rel="icon"[^>]* href="([^"]+)"/.exec(index)?.[1] ?? '';
    expect(icon.startsWith('/'), 'no icon link');
    return `theme-color ${theme}, icon ${icon}`;
  });
  await check('favicon is served', async () => {
    expect(icon !== '', 'no icon link in the page');
    const res = await fetch(`${site}${icon}`);
    expect(res.status === 200, `GET ${icon} → ${res.status}`);
    expect(/^image\//.test(res.headers.get('content-type') ?? ''), 'not an image');
    return `GET ${icon} → 200 ${res.headers.get('content-type')}`;
  });
  for (const path of [...WEB_PAGE_PATHS, UNKNOWN_PAGE_PATH]) {
    await check(`page path ${path} serves the page`, async () => {
      const res = await fetch(`${site}${path}`);
      const body = await res.text();
      expect(res.status === 200, `GET ${path} → ${res.status}`);
      expect(body === index, 'body differs from index.html');
      return `GET ${path} → 200, same page`;
    });
  }
  for (const path of MISSING_FILES) {
    await check(`missing file ${path} is a 404`, async () => {
      const res = await fetch(`${site}${path}`);
      expect(isMissing(res.status), `GET ${path} → ${res.status}`);
      return `GET ${path} → 404`;
    });
  }
  await check(`/${ROBOTS_FILE} matches infra`, async () => {
    const res = await fetch(`${site}/${ROBOTS_FILE}`);
    expect(res.status === 200, `GET → ${res.status}`);
    expect(/^text\/plain/.test(res.headers.get('content-type') ?? ''), 'not text/plain');
    expect((await res.text()) === robotsTxt(config), 'content differs from infra');
    return config.searchIndexing ? 'GET → 200, allows crawling' : 'GET → 200, Disallow: /';
  });

  // Universal-link files: exactly what infra publishes -----------------------------------
  const published = new Map(wellKnownFiles(config.appLinks).map((f) => [f.key, f.body]));
  for (const key of WELL_KNOWN_KEYS) {
    await check(`/${key} matches infra`, async () => {
      const res = await fetch(`${site}/${key}`);
      const expected = published.get(key);
      if (expected === undefined) {
        expect(isMissing(res.status), `not published by infra, but GET → ${res.status}`);
        return `not published yet (GET → ${res.status})`;
      }
      expect(res.status === 200, `GET → ${res.status}`);
      expect(/application\/json/.test(res.headers.get('content-type') ?? ''), 'not JSON');
      const body: unknown = JSON.parse(await res.text());
      expect(JSON.stringify(body) === JSON.stringify(expected), 'content differs from infra');
      return 'GET → 200 JSON, same as infra';
    });
  }

  // Club API ----------------------------------------------------------------------------
  const api = cloud.clubApiUrl;
  if (!api) {
    results.push({ name: 'club API', ok: false, detail: 'no clubApiUrl in CLOUD_ENVIRONMENTS' });
  } else {
    const route = `${api}${API_PATHS.myClubs}`;
    await check(`club API ${API_PATHS.myClubs} needs a token`, async () => {
      const res = await fetch(route);
      const body = JSON.parse(await res.text()) as { error?: { code?: string } };
      expect(res.status === 401, `GET without a token → ${res.status}`);
      expect(body.error?.code === 'not_authenticated', `error code ${body.error?.code}`);
      return 'GET without a token → 401 not_authenticated';
    });
    const preflight = (origin: string) =>
      fetch(route, {
        method: 'OPTIONS',
        headers: {
          origin,
          'access-control-request-method': 'GET',
          'access-control-request-headers': 'authorization',
        },
      });
    await check('CORS preflight from the web origin is allowed', async () => {
      const res = await preflight(site);
      const allowed = res.headers.get('access-control-allow-origin');
      expect(res.status < 300, `OPTIONS → ${res.status}`);
      expect(allowed === site, `allow-origin is ${allowed ?? 'missing'}`);
      const headers = (res.headers.get('access-control-allow-headers') ?? '').toLowerCase();
      expect(headers.includes('authorization'), 'authorization header not allowed');
      return `OPTIONS → ${res.status}, allow-origin ${site}`;
    });
    await check('CORS preflight from another origin is not allowed', async () => {
      const allowed = (await preflight(FOREIGN_ORIGIN)).headers.get('access-control-allow-origin');
      expect(allowed !== FOREIGN_ORIGIN && allowed !== '*', `allow-origin is ${allowed}`);
      return `allow-origin ${allowed ?? 'absent'}`;
    });
  }

  // Stripe webhook: unsigned requests are refused before any work ------------------------
  const webhook = cloud.stripeWebhookUrl;
  if (!webhook) {
    results.push({
      name: 'Stripe webhook',
      ok: false,
      detail: 'no stripeWebhookUrl in CLOUD_ENVIRONMENTS',
    });
  } else {
    await check('Stripe webhook rejects an unsigned POST', async () => {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // Not a real event, and no stripe-signature header: rejected before anything runs.
        body: '{"smoke":true}',
      });
      expect(res.status >= 400 && res.status < 500, `unsigned POST → ${res.status}`);
      return `unsigned POST → ${res.status}`;
    });
  }

  return results;
}

/** One line per check, then a summary; the exit code is 0 only if every check passed. */
export function formatSmoke(envName: string, results: readonly SmokeResult[]): string {
  const lines = results.map((r) => `${r.ok ? 'PASS' : 'FAIL'}  ${r.name}: ${r.detail}`);
  const failed = results.filter((r) => !r.ok).length;
  lines.push(
    failed === 0
      ? `${envName}: all ${results.length} checks passed`
      : `${envName}: ${failed} of ${results.length} checks failed`,
  );
  return lines.join('\n');
}
