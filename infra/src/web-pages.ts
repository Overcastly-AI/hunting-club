import { MAP_PACKS_PREFIX } from '@huntclub/shared/maps';
import type { EnvConfig } from '../config';

/** The page that answers every page path (the web app routes it, or shows Page not found). */
export const WEB_PAGE_OBJECT = '/index.html';

/** Universal-link files: no file extension, but files, never the page. */
export const WELL_KNOWN_PREFIX = '.well-known/';

/** Key prefixes in the site bucket that are always files, whatever their names look like. */
export const FILE_PREFIXES = [WELL_KNOWN_PREFIX, MAP_PACKS_PREFIX] as const;

/**
 * Source of the CloudFront Function (viewer request, JS runtime 2.0) behind the SPA
 * fallback: every path whose last segment has no file extension is a page path and gets
 * index.html (200), so a deep link or a mistyped path reaches the web app, which shows the
 * page or Page not found. Paths with an extension (hashed assets, favicon.svg, robots.txt)
 * and FILE_PREFIXES go to S3 unchanged, so a missing file is a real 404. `/` is left to the
 * distribution's default root object. Join links keep their data in the URL fragment,
 * which never reaches CloudFront.
 */
export function webPageRewriteSource(): string {
  const prefixes = FILE_PREFIXES.map((p) => `/${p}`);
  return [
    `var FILE_PREFIXES = ${JSON.stringify(prefixes)};`,
    'function handler(event) {',
    '  var request = event.request;',
    '  var uri = request.uri;',
    "  if (uri === '/') return request;",
    '  for (var i = 0; i < FILE_PREFIXES.length; i++) {',
    '    if (uri.indexOf(FILE_PREFIXES[i]) === 0) return request;',
    '  }',
    "  var last = uri.replace(/\\/+$/, '').split('/').pop();",
    `  if (last.indexOf('.') === -1) request.uri = ${JSON.stringify(WEB_PAGE_OBJECT)};`,
    '  return request;',
    '}',
  ].join('\n');
}

/**
 * robots.txt for an environment: only an environment marked indexable may be crawled;
 * every other one (dev) disallows everything.
 */
export function robotsTxt(config: Pick<EnvConfig, 'searchIndexing'>): string {
  return ['User-agent: *', config.searchIndexing ? 'Allow: /' : 'Disallow: /', ''].join('\n');
}

/** robots.txt's key in the site bucket. */
export const ROBOTS_FILE = 'robots.txt';
