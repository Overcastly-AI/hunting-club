import { WEB_PAGE_PATHS } from '@huntclub/shared/app';

/** The page that answers every path in WEB_PAGE_PATHS. */
export const WEB_PAGE_OBJECT = '/index.html';

/**
 * Source of the CloudFront Function (viewer request, JS runtime 2.0) that serves
 * index.html for the web page's real paths (join fallback, Checkout return pages).
 * Generated from WEB_PAGE_PATHS so the list is never retyped. Any other path goes to
 * S3 unchanged; a trailing slash is tolerated. Join links keep their data in the URL
 * fragment, which never reaches CloudFront.
 */
export function webPageRewriteSource(paths: readonly string[] = WEB_PAGE_PATHS): string {
  const pages = Object.fromEntries(paths.map((p) => [p, true]));
  return [
    `var PAGES = ${JSON.stringify(pages)};`,
    'function handler(event) {',
    '  var request = event.request;',
    "  var path = request.uri.length > 1 ? request.uri.replace(/\\/+$/, '') : request.uri;",
    `  if (PAGES[path] === true) request.uri = ${JSON.stringify(WEB_PAGE_OBJECT)};`,
    '  return request;',
    '}',
  ].join('\n');
}
