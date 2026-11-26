import { CHECKOUT_RETURN_PATHS, JOIN_PATH, WEB_PAGE_PATHS } from '@huntclub/shared/app';
import { MAP_PACKS_PREFIX } from '@huntclub/shared/maps';
import { robotsTxt, WEB_PAGE_OBJECT, webPageRewriteSource } from '../src/web-pages';

/** Runs the generated CloudFront Function source on a request URI. */
function rewrite(uri: string): string {
  const handler = new Function(`${webPageRewriteSource()}\nreturn handler;`)() as (event: {
    request: { uri: string };
  }) => { uri: string };
  return handler({ request: { uri } }).uri;
}

describe('web page rewrite (CloudFront Function)', () => {
  it('serves index.html for the join and Checkout return paths', () => {
    expect(WEB_PAGE_PATHS).toEqual([
      JOIN_PATH,
      CHECKOUT_RETURN_PATHS.success,
      CHECKOUT_RETURN_PATHS.cancel,
    ]);
    for (const path of WEB_PAGE_PATHS) {
      expect(rewrite(path)).toBe(WEB_PAGE_OBJECT);
      expect(rewrite(`${path}/`)).toBe(WEB_PAGE_OBJECT);
    }
  });

  it('serves index.html for any other page path, so the app can show Page not found', () => {
    for (const uri of ['/joined', '/join/x', '/admin/settings/', '/nope', '//']) {
      expect(rewrite(uri)).toBe(WEB_PAGE_OBJECT);
    }
  });

  it('sends files to S3 unchanged, so a missing one is a real 404', () => {
    for (const uri of [
      '/',
      '/index.html',
      '/favicon.svg',
      '/favicon.ico',
      '/robots.txt',
      '/assets/index-abc.js',
      '/assets/missing.js',
      '/.well-known/apple-app-site-association',
      '/.well-known/assetlinks.json',
      `/${MAP_PACKS_PREFIX}club-1/pack`,
    ]) {
      expect(rewrite(uri)).toBe(uri);
    }
  });
});

describe('robots.txt', () => {
  it('disallows everything unless the environment is indexable', () => {
    expect(robotsTxt({ searchIndexing: false })).toBe('User-agent: *\nDisallow: /\n');
    expect(robotsTxt({ searchIndexing: true })).toBe('User-agent: *\nAllow: /\n');
  });
});
