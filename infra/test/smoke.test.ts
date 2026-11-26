import { colors } from '@huntclub/design';
import { API_PATHS, WEB_PAGE_PATHS } from '@huntclub/shared';
import { dev } from '../config/dev';
import { cloudFor, formatSmoke, runSmoke, UNKNOWN_PAGE_PATH, type SmokeFetch } from '../src/smoke';
import { robotsTxt } from '../src/web-pages';

const SITE = `https://${dev.domainName}`;
/** The head the Vite build writes (web/site-head.ts), then the app root. */
const INDEX = [
  '<!doctype html><head><title>Hunt Club Mesh</title>',
  '<meta name="description" content="Off-grid hunting.">',
  `<meta name="theme-color" content="${colors.surface}">`,
  '<link rel="icon" type="image/svg+xml" href="/favicon.svg">',
  '</head><div id="root"></div>',
].join('');
const PAGE_PATHS = ['/', ...WEB_PAGE_PATHS, UNKNOWN_PAGE_PATH];

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
    if (PAGE_PATHS.some((p) => url === `${SITE}${p}`)) {
      return reply(200, INDEX, { 'content-type': 'text/html' });
    }
    if (url === `${SITE}/favicon.svg`)
      return reply(200, '<svg/>', { 'content-type': 'image/svg+xml' });
    if (url === `${SITE}/robots.txt`) {
      return reply(200, robotsTxt(dev), { 'content-type': 'text/plain; charset=utf-8' });
    }
    if (url.startsWith(SITE)) return reply(404);
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

  it('fails when a page path is not rewritten to the page', async () => {
    const { fetch } = fakeDev({ [`${SITE}${UNKNOWN_PAGE_PATH}`]: 403 });
    const failed = (await runSmoke(dev, fetch)).filter((r) => !r.ok);
    expect(failed.map((r) => r.name)).toEqual([`page path ${UNKNOWN_PAGE_PATH} serves the page`]);
  });

  it('fails a missing file answered with 403 instead of 404 (the old first-load favicon 403)', async () => {
    const { fetch } = fakeDev({ [`${SITE}/favicon.ico`]: 403 });
    const failed = (await runSmoke(dev, fetch)).filter((r) => !r.ok);
    expect(failed.map((r) => r.detail)).toEqual(['GET /favicon.ico → 403']);
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
