// Read-only smoke check of a deployed environment: the public site and club admin, the
// CloudFront redirects and 404s, the universal-link
// files, the club API's auth and CORS, and the Stripe webhook's signature check.
// Every URL comes from the single sources (CLOUD_ENVIRONMENTS, the env config); nothing
// here writes, signs anyone up or sends email.
import { colors, FAVICON_ICO } from '@huntclub/design';
import { ADMIN_PATH, API_PATHS, BUILD_VERSION_URL, WEB_PAGE_PATHS } from '@huntclub/shared';
import { cspViolations } from '@huntclub/site/csp';
import {
  canonicalUrl,
  JOIN_PAGE,
  NAV_LINKS,
  NOT_FOUND_PAGE,
  REDIRECTS,
  ROUTES,
  SITEMAP_FILE,
} from '@huntclub/site/routes';
import type { EnvConfig } from '../config';
import { cloudFor } from './cloud';
import { contentSecurityPolicy, PERMISSIONS_POLICY, REFERRER_POLICY } from './security-headers';
import { NOINDEX_HEADER, ROBOTS_FILE, robotsTxt } from './web-pages';
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

/** A path no page uses: CloudFront must answer with the 404 page and a 404 status. */
export const UNKNOWN_PAGE_PATH = '/smoke-unknown-page';

/** Redirects the CloudFront Function makes: the registry's, the bare admin root and a trailing slash. */
export const SMOKE_REDIRECTS: Record<string, string> = {
  ...REDIRECTS,
  [ADMIN_PATH.replace(/\/$/, '')]: ADMIN_PATH,
  [`${UNKNOWN_PAGE_PATH}/`]: UNKNOWN_PAGE_PATH,
};

/** Files that do not exist: CloudFront may list the bucket, so each must be a real 404. */
export const MISSING_FILES = ['/assets/smoke-missing.js'];

const isMissing = (status: number) => status === 404;

/** The content of `<meta name="…" content="…">` in the page, as Vite writes it. */
const metaContent = (html: string, name: string) =>
  new RegExp(`<meta name="${name}" content="([^"]*)"`).exec(html)?.[1];

export { cloudFor };

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

  // Public site -------------------------------------------------------------------------
  let home = '';
  await check('site serves the home page', async () => {
    const res = await fetch(`${site}/`);
    home = await res.text();
    expect(res.status === 200, `GET / → ${res.status}`);
    expect(/text\/html/.test(res.headers.get('content-type') ?? ''), 'not text/html');
    expect((home.match(/<h1[\s>]/g) ?? []).length === 1, 'not exactly one <h1>');
    const robots = res.headers.get(NOINDEX_HEADER.header);
    if (config.searchIndexing) expect(robots === null, `${NOINDEX_HEADER.header} is ${robots}`);
    else
      expect(robots === NOINDEX_HEADER.value, `${NOINDEX_HEADER.header} is ${robots ?? 'missing'}`);
    return `GET / → 200 text/html, ${NOINDEX_HEADER.header} ${robots ?? 'absent'}`;
  });
  await check(
    'home page has no inline code the CSP would block, and its scripts load',
    async () => {
      const blocked = cspViolations(home);
      expect(blocked.length === 0, `CSP would block: ${blocked.join(', ')}`);
      const scripts = [...home.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]!);
      for (const src of scripts) {
        const res = await fetch(`${site}${src}`);
        expect(res.status === 200, `GET ${src} → ${res.status}`);
      }
      return `no inline scripts, styles or handlers; ${scripts.length} script file(s) → 200`;
    },
  );
  let icon = '';
  await check('page head has a title, description, theme color and icon', async () => {
    expect(/<title>[^<]+<\/title>/.test(home), 'no title');
    expect(Boolean(metaContent(home, 'description')), 'no meta description');
    const theme = metaContent(home, 'theme-color');
    expect(theme === colors.surface, `theme-color is ${theme ?? 'missing'}`);
    icon = /<link rel="icon" type="image\/svg\+xml" href="([^"]+)"/.exec(home)?.[1] ?? '';
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
  await check(`/${FAVICON_ICO.file} is served`, async () => {
    const res = await fetch(`${site}/${FAVICON_ICO.file}`);
    expect(res.status === 200, `GET → ${res.status}`);
    expect(/^image\//.test(res.headers.get('content-type') ?? ''), 'not an image');
    return `GET → 200 ${res.headers.get('content-type')}`;
  });
  await check('home page shares a card and says what the app is (JSON-LD)', async () => {
    const image = /<meta property="og:image" content="([^"]+)"/.exec(home)?.[1] ?? '';
    expect(image.startsWith(`${site}/`), `og:image is ${image || 'missing'}`);
    const res = await fetch(image);
    expect(res.status === 200, `GET ${image} → ${res.status}`);
    expect(res.headers.get('content-type') === 'image/png', 'card is not a PNG');
    const types = [...home.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)]
      .map((m) => JSON.parse(m[1]!) as { '@type'?: string; aggregateRating?: unknown })
      .map((d) => {
        expect(d.aggregateRating === undefined, 'structured data claims a rating');
        return d['@type'];
      });
    expect(types.includes('SoftwareApplication'), `JSON-LD types: ${types.join(', ') || 'none'}`);
    return `og:image → 200 PNG; JSON-LD ${types.join(', ')}`;
  });
  await check(`/${SITEMAP_FILE} lists the site`, async () => {
    const res = await fetch(`${site}/${SITEMAP_FILE}`);
    const body = await res.text();
    expect(res.status === 200, `GET → ${res.status}`);
    expect(/xml/.test(res.headers.get('content-type') ?? ''), 'not XML');
    expect(body.includes(`<loc>${canonicalUrl('/')}</loc>`), 'no home page entry');
    return 'GET → 200 XML';
  });

  for (const route of ROUTES.filter((r) => r.path !== '/')) {
    await check(`site page ${route.path} is served`, async () => {
      const res = await fetch(`${site}${route.path}`);
      const body = await res.text();
      expect(res.status === 200, `GET → ${res.status}`);
      expect(body.includes(`<title>${route.title}</title>`), 'not this page (title differs)');
      expect((body.match(/<h1[\s>]/g) ?? []).length === 1, 'not exactly one <h1>');
      return 'GET → 200, its title and one <h1>';
    });
  }

  await check(`invite page ${JOIN_PAGE.path} is served noindex with no referrer`, async () => {
    const res = await fetch(`${site}${JOIN_PAGE.path}`);
    const body = await res.text();
    const referrer = res.headers.get('referrer-policy');
    expect(res.status === 200, `GET → ${res.status}`);
    expect(body.includes(`<title>${JOIN_PAGE.title}</title>`), 'not the invite page');
    expect(body.includes('<meta name="robots" content="noindex"/>'), 'no noindex meta');
    expect(referrer === 'no-referrer', `referrer-policy is ${referrer ?? 'missing'}`);
    const script = /<script type="module" src="(\/assets\/[^"]+\.js)">/.exec(body)?.[1];
    expect(Boolean(script), 'no self-hosted script');
    const js = await fetch(`${site}${script}`);
    expect(js.status === 200, `GET ${script} → ${js.status}`);
    return `GET → 200, noindex, no-referrer, ${script} → 200`;
  });

  // Security headers (security-headers.ts): the same CSP everywhere; /join sends no referrer.
  const expected = {
    'content-security-policy': contentSecurityPolicy(config),
    [PERMISSIONS_POLICY.header.toLowerCase()]: PERMISSIONS_POLICY.value,
    'x-frame-options': 'DENY',
    'x-content-type-options': 'nosniff',
  };
  for (const [path, referrer] of [
    ['/', REFERRER_POLICY.site],
    [ADMIN_PATH, REFERRER_POLICY.site],
    [JOIN_PAGE.path, REFERRER_POLICY.join],
  ] as const) {
    await check(`${path} sends the security headers`, async () => {
      const res = await fetch(`${site}${path}`);
      const wrong = Object.entries({ ...expected, 'referrer-policy': referrer })
        .filter(([name, value]) => res.headers.get(name) !== value)
        .map(([name]) => name);
      const hsts = res.headers.get('strict-transport-security') ?? '';
      if (!/max-age=\d+/.test(hsts)) wrong.push('strict-transport-security');
      expect(wrong.length === 0, `wrong or missing: ${wrong.join(', ')}`);
      return `CSP, Permissions-Policy, frame DENY, nosniff, HSTS, referrer ${referrer}`;
    });
  }

  // Club admin (ADMIN_PATH) and the real paths it still answers --------------------------
  let admin = '';
  await check(`admin is served at ${ADMIN_PATH}`, async () => {
    const res = await fetch(`${site}${ADMIN_PATH}`);
    admin = await res.text();
    expect(res.status === 200, `GET ${ADMIN_PATH} → ${res.status}`);
    expect(admin.includes('id="root"'), 'no app root element');
    return `GET ${ADMIN_PATH} → 200, app root`;
  });
  await check(`${BUILD_VERSION_URL} is served uncached`, async () => {
    const res = await fetch(`${site}${BUILD_VERSION_URL}`);
    const cache = res.headers.get('cache-control') ?? '';
    const body = JSON.parse(await res.text()) as { buildId?: unknown };
    expect(res.status === 200, `GET → ${res.status}`);
    expect(typeof body.buildId === 'string', 'no buildId');
    expect(/no-cache|no-store/.test(cache), `cache-control is ${cache || 'missing'}`);
    return `GET → 200, cache-control ${cache}`;
  });
  for (const path of WEB_PAGE_PATHS) {
    await check(`page path ${path} serves the admin`, async () => {
      const res = await fetch(`${site}${path}`);
      const body = await res.text();
      expect(res.status === 200, `GET ${path} → ${res.status}`);
      expect(admin !== '' && body === admin, `body differs from ${ADMIN_PATH}`);
      return `GET ${path} → 200, same page`;
    });
  }

  // Redirects and misses --------------------------------------------------------------------
  for (const [from, to] of Object.entries(SMOKE_REDIRECTS)) {
    await check(`${from} redirects to ${to}`, async () => {
      const res = await fetch(`${site}${from}`, { redirect: 'manual' });
      const location = res.headers.get('location');
      expect(res.status === 301, `GET ${from} → ${res.status}`);
      expect(location === to || location === `${site}${to}`, `location ${location ?? 'missing'}`);
      return `GET ${from} → 301 ${to}`;
    });
  }
  await check(`unknown path ${UNKNOWN_PAGE_PATH} is the 404 page`, async () => {
    const res = await fetch(`${site}${UNKNOWN_PAGE_PATH}`);
    const body = await res.text();
    expect(res.status === 404, `GET → ${res.status}`);
    expect(body.includes(`<title>${NOT_FOUND_PAGE.title}</title>`), 'not the 404 page');
    // The shared header and footer, a way home and a way to the admin.
    const missing = [...NAV_LINKS.map((l) => l.href), '/', ADMIN_PATH].filter(
      (href) => !body.includes(`href="${href}"`),
    );
    expect(missing.length === 0, `no link to ${missing.join(', ')}`);
    expect(/<header[\s>]/.test(body) && /<footer[\s>]/.test(body), 'no site header or footer');
    return 'GET → 404, branded page with the site nav, home and admin links';
  });
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
