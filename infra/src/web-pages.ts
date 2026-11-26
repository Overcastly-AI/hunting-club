import { ADMIN_PATH } from '@huntclub/shared/app';
import {
  ADMIN_PAGE_PATHS,
  NOINDEX_PATHS,
  NOT_FOUND_PAGE,
  outputFile,
  REDIRECTS,
  ROUTES,
  SITEMAP_FILE,
} from '@huntclub/site/routes';
import type { EnvConfig } from '../config';

/** The club admin's page in the bucket (web/dist, deployed under ADMIN_PATH). */
export const ADMIN_PREFIX = ADMIN_PATH.slice(1); // "app/"
export const ADMIN_PAGE_OBJECT = `${ADMIN_PATH}index.html`;

/** Universal-link files: no file extension, but files, never pages. */
export const WELL_KNOWN_PREFIX = '.well-known/';

/** The branded not-found page CloudFront serves, with a 404 status, for any missing path. */
export const NOT_FOUND_OBJECT = `/${NOT_FOUND_PAGE.file}`;

/** Public site pages by path → their object in the bucket (from the site's route registry). */
export function sitePageObjects(): Record<string, string> {
  return Object.fromEntries(ROUTES.map((r) => [r.path, `/${outputFile(r.path)}`]));
}

/**
 * Source of the CloudFront Function (viewer request, JS runtime 2.0). An allowlist
 * generated from the site's route registry, in this order:
 * 1. REDIRECTS (301): /index.html → /, /login and /sign-in → the admin.
 * 2. The admin: /app → /app/ (301); /app/ and any extensionless path under it → its
 *    index.html (hash routes); its files (/app/assets/…) pass through.
 * 3. A trailing slash anywhere else → 301 to the path without it.
 * 4. A registered site page → its <path>/index.html.
 * 5. A real path the admin still answers (/join, /checkout/*, /privacy, /terms) → the
 *    admin's index.html.
 * Anything else goes to S3 as is: a missing key is a 404, which the distribution answers
 * with the 404 page. Join links keep their data in the URL fragment, which never
 * reaches CloudFront.
 */
export function webPageRewriteSource(): string {
  const adminRoot = ADMIN_PATH.replace(/\/$/, '');
  const adminPages = Object.fromEntries(ADMIN_PAGE_PATHS.map((p) => [p, true]));
  return [
    `var REDIRECTS = ${JSON.stringify(REDIRECTS)};`,
    `var SITE = ${JSON.stringify(sitePageObjects())};`,
    `var ADMIN_PAGES = ${JSON.stringify(adminPages)};`,
    `var ADMIN_ROOT = ${JSON.stringify(adminRoot)};`,
    `var ADMIN_INDEX = ${JSON.stringify(ADMIN_PAGE_OBJECT)};`,
    'function redirect(to) {',
    "  return { statusCode: 301, statusDescription: 'Moved Permanently', headers: { location: { value: to } } };",
    '}',
    'function handler(event) {',
    '  var request = event.request;',
    '  var uri = request.uri;',
    '  if (REDIRECTS[uri]) return redirect(REDIRECTS[uri]);',
    "  if (uri === ADMIN_ROOT) return redirect(ADMIN_ROOT + '/');",
    "  if (uri.indexOf(ADMIN_ROOT + '/') === 0) {",
    "    if (uri.split('/').pop().indexOf('.') === -1) request.uri = ADMIN_INDEX;",
    '    return request;',
    '  }',
    "  if (uri.length > 1 && uri.charAt(uri.length - 1) === '/') {",
    "    return redirect(uri.replace(/\\/+$/, '') || '/');",
    '  }',
    '  if (SITE[uri]) {',
    '    request.uri = SITE[uri];',
    '    return request;',
    '  }',
    '  if (ADMIN_PAGES[uri] === true) request.uri = ADMIN_INDEX;',
    '  return request;',
    '}',
  ].join('\n');
}

/**
 * robots.txt for an environment. Dev disallows everything (and sends X-Robots-Tag). An
 * indexable environment allows the site but not the admin, invites or Checkout pages,
 * and points at the sitemap.
 */
export function robotsTxt(config: Pick<EnvConfig, 'searchIndexing' | 'domainName'>): string {
  const lines = config.searchIndexing
    ? [
        'Allow: /',
        ...NOINDEX_PATHS.map((p) => `Disallow: ${p}`),
        `Sitemap: https://${config.domainName}/${SITEMAP_FILE}`,
      ]
    : ['Disallow: /'];
  return ['User-agent: *', ...lines, ''].join('\n');
}

/** robots.txt's key in the site bucket. */
export const ROBOTS_FILE = 'robots.txt';

/** Header that keeps a non-indexable environment (dev) out of search results. */
export const NOINDEX_HEADER = { header: 'X-Robots-Tag', value: 'noindex, nofollow' } as const;
