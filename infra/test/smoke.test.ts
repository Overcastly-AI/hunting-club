import { colors } from '@huntclub/design';
import { ADMIN_PATH, API_PATHS, BUILD_VERSION_URL, WEB_PAGE_PATHS } from '@huntclub/shared';
import { JOIN_PAGE, NOT_FOUND_PAGE, ROUTES, sitemapXml, SITEMAP_FILE } from '@huntclub/site/routes';
import { dev } from '../config/dev';
import {
  cloudFor,
  formatSmoke,
  runSmoke,
  SMOKE_REDIRECTS,
  UNKNOWN_PAGE_PATH,
  type SmokeFetch,
} from '../src/smoke';
import { NOINDEX_HEADER, robotsTxt } from '../src/web-pages';

const SITE = `https://${dev.domainName}`;
/** The head the site's Shell writes, then one H1. */
const HOME = [
  '<!doctype html><head><title>Hunt Club Mesh</title>',
  '<meta name="description" content="Off-grid hunting.">',
  `<meta name="theme-color" content="${colors.surface}">`,
  '<link rel="icon" href="/favicon.ico" sizes="48x48">',
  '<link rel="icon" type="image/svg+xml" href="/favicon.svg">',
  '</head><body><h1>Hunt Club Mesh</h1></body>',
].join('');
/** The admin's page (web/dist index.html under ADMIN_PATH). */
const ADMIN = '<!doctype html><head><title>Club admin</title></head><div id="root"></div>';
const NOT_FOUND = `<!doctype html><head><title>${NOT_FOUND_PAGE.title}</title></head>`;
const ADMIN_PATHS = [ADMIN_PATH, ...WEB_PAGE_PATHS];
const HTML = { 'content-type': 'text/html' };
const JOIN_SCRIPT = '/assets/join-abc.js';

/** A healthy deployment as the checks expect it; `override` breaks one URL. */
function fakeDev(override: Record<string, number> = {}): {
  fetch: SmokeFetch;
  calls: { url: string; method: string }[];
} {
  const cloud = cloudFor(dev);
  const calls: { url: string; method: string }[] = [];
  const fetch: SmokeFetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url, method });
    const reply = (status: number, body = '', headers: Record<string, string> = {}) => ({
      status: override[url] ?? status,
      headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
      text: async () => body,
    });
    if (url === `${SITE}/`) {
      return reply(200, HOME, { ...HTML, 'x-robots-tag': NOINDEX_HEADER.value });
    }
    if (url === `${SITE}${JOIN_PAGE.path}`) {
      const page = `<title>${JOIN_PAGE.title}</title><meta name="robots" content="noindex"/><script type="module" src="${JOIN_SCRIPT}"></script>`;
      return reply(200, page, { ...HTML, 'referrer-policy': 'no-referrer' });
    }
    if (url === `${SITE}${JOIN_SCRIPT}`)
      return reply(200, '', { 'content-type': 'text/javascript' });
    const route = ROUTES.find((r) => r.path !== '/' && url === `${SITE}${r.path}`);
    if (route) return reply(200, `<title>${route.title}</title><h1>Page</h1>`, HTML);
    if (ADMIN_PATHS.some((p) => url === `${SITE}${p}`)) return reply(200, ADMIN, HTML);
    const redirect = Object.entries(SMOKE_REDIRECTS).find(([from]) => url === `${SITE}${from}`);
    if (redirect) return reply(301, '', { location: redirect[1] });
    if (url === `${SITE}${BUILD_VERSION_URL}`) {
      return reply(200, '{"buildId":"b1"}', { 'cache-control': 'no-cache' });
    }
    if (url === `${SITE}/${SITEMAP_FILE}`) {
      return reply(200, sitemapXml('2026-11-26'), { 'content-type': 'application/xml' });
    }
    if (url === `${SITE}/favicon.svg`)
      return reply(200, '<svg/>', { 'content-type': 'image/svg+xml' });
    if (url === `${SITE}/favicon.ico`) return reply(200, 'ico', { 'content-type': 'image/x-icon' });
    if (url === `${SITE}/robots.txt`) {
      return reply(200, robotsTxt(dev), { 'content-type': 'text/plain; charset=utf-8' });
    }
    if (url.startsWith(SITE)) return reply(404, NOT_FOUND, HTML);
    if (url === `${cloud.clubApiUrl}${API_PATHS.myClubs}`) {
      if (method === 'OPTIONS') {
        const origin = init.headers?.origin;
        return reply(
          200,
          '',
          origin === SITE
            ? {
                'access-control-allow-origin': SITE,
                'access-control-allow-headers': 'authorization',
              }
            : {},
        );
      }
      return reply(401, JSON.stringify({ error: { code: 'not_authenticated' } }));
    }
    if (url === cloud.stripeWebhookUrl) return reply(400, '{}');
    throw new Error(`unexpected ${method} ${url}`);
  };
  return { fetch, calls };
}

describe('dev smoke check', () => {
  it('passes against a healthy deployment, with read-only requests and one unsigned POST', async () => {
    const { fetch, calls } = fakeDev();
    const results = await runSmoke(dev, fetch);
    expect(results.filter((r) => !r.ok)).toEqual([]);
    expect(calls.filter((c) => c.method === 'POST')).toEqual([
      { url: cloudFor(dev).stripeWebhookUrl, method: 'POST' },
    ]);
    expect(calls.every((c) => ['GET', 'OPTIONS', 'POST'].includes(c.method))).toBe(true);
    expect(formatSmoke('dev', results)).toMatch(/all \d+ checks passed$/);
  });

  it('fails a webhook that errors instead of refusing, and says how many failed', async () => {
    const { fetch } = fakeDev({ [cloudFor(dev).stripeWebhookUrl!]: 502 });
    const results = await runSmoke(dev, fetch);
    expect(results.filter((r) => !r.ok).map((r) => r.detail)).toEqual(['unsigned POST → 502']);
    expect(formatSmoke('dev', results)).toMatch(/1 of \d+ checks failed$/);
  });

  it('fails an unknown path answered with 200 instead of the 404 page', async () => {
    const { fetch } = fakeDev({ [`${SITE}${UNKNOWN_PAGE_PATH}`]: 200 });
    const failed = (await runSmoke(dev, fetch)).filter((r) => !r.ok);
    expect(failed.map((r) => r.name)).toEqual([
      `unknown path ${UNKNOWN_PAGE_PATH} is the 404 page`,
    ]);
  });

  it('fails when a real admin path is not rewritten to the admin', async () => {
    const path = WEB_PAGE_PATHS[0];
    const { fetch } = fakeDev({ [`${SITE}${path}`]: 404 });
    const failed = (await runSmoke(dev, fetch)).filter((r) => !r.ok);
    expect(failed.map((r) => r.name)).toEqual([`page path ${path} serves the admin`]);
  });

  it('fails a redirect that serves the page instead', async () => {
    const { fetch } = fakeDev({ [`${SITE}/index.html`]: 200 });
    const failed = (await runSmoke(dev, fetch)).filter((r) => !r.ok);
    expect(failed.map((r) => r.detail)).toEqual(['GET /index.html → 200']);
  });

  it('fails dev without the noindex header, and checks every redirect', async () => {
    const { fetch } = fakeDev();
    const stripped: SmokeFetch = async (url, init) => {
      const res = await fetch(url, init);
      return url === `${SITE}/` ? { ...res, headers: { get: () => null } } : res;
    };
    const results = await runSmoke(dev, stripped);
    expect(results.filter((r) => !r.ok).map((r) => r.name)).toContain('site serves the home page');
    for (const from of Object.keys(SMOKE_REDIRECTS)) {
      expect(results.some((r) => r.name.startsWith(`${from} redirects`))).toBe(true);
    }
  });

  it('fails when the admin version file is missing', async () => {
    const { fetch } = fakeDev({ [`${SITE}${BUILD_VERSION_URL}`]: 404 });
    const failed = (await runSmoke(dev, fetch)).filter((r) => !r.ok);
    expect(failed.map((r) => r.name)).toEqual([`${BUILD_VERSION_URL} is served uncached`]);
  });

  it('fails a site page that is missing or is another page', async () => {
    const { fetch } = fakeDev();
    const wrong: SmokeFetch = async (url, init) =>
      url === `${SITE}/pricing` ? fetch(`${SITE}/`, init) : fetch(url, init);
    const failed = (await runSmoke(dev, wrong)).filter((r) => !r.ok);
    expect(failed.map((r) => [r.name, r.detail])).toEqual([
      ['site page /pricing is served', 'not this page (title differs)'],
    ]);
  });

  it('fails an invite page sent with a referrer', async () => {
    const { fetch } = fakeDev();
    const leaky: SmokeFetch = async (url, init) => {
      const res = await fetch(url, init);
      return url === `${SITE}${JOIN_PAGE.path}` ? { ...res, headers: { get: () => null } } : res;
    };
    const failed = (await runSmoke(dev, leaky)).filter((r) => !r.ok);
    expect(failed.map((r) => r.detail)).toEqual(['referrer-policy is missing']);
  });

  it('fails when the sitemap is missing', async () => {
    const { fetch } = fakeDev({ [`${SITE}/${SITEMAP_FILE}`]: 404 });
    const failed = (await runSmoke(dev, fetch)).filter((r) => !r.ok);
    expect(failed.map((r) => r.name)).toEqual([`/${SITEMAP_FILE} lists the site`]);
  });

  it('fails a missing file answered with 403 instead of 404', async () => {
    const { fetch } = fakeDev({ [`${SITE}/assets/smoke-missing.js`]: 403 });
    const failed = (await runSmoke(dev, fetch)).filter((r) => !r.ok);
    expect(failed.map((r) => r.detail)).toEqual(['GET /assets/smoke-missing.js → 403']);
  });

  it('fails when /favicon.ico is a raw 404 instead of the icon', async () => {
    const { fetch } = fakeDev({ [`${SITE}/favicon.ico`]: 404 });
    const failed = (await runSmoke(dev, fetch)).filter((r) => !r.ok);
    expect(failed.map((r) => r.name)).toEqual(['/favicon.ico is served']);
  });

  it('fails when robots.txt or the favicon is missing', async () => {
    const { fetch } = fakeDev({ [`${SITE}/robots.txt`]: 404, [`${SITE}/favicon.svg`]: 404 });
    const failed = (await runSmoke(dev, fetch)).filter((r) => !r.ok);
    expect(failed.map((r) => r.name).sort()).toEqual([
      '/robots.txt matches infra',
      'favicon is served',
    ]);
  });
});
