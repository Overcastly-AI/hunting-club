import { CHECKOUT_RETURN_PATHS, JOIN_PATH, WEB_PAGE_PATHS } from '@huntclub/shared/app';
import { WEB_PAGE_OBJECT, webPageRewriteSource } from '../src/web-pages';

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

  it('leaves every other path alone', () => {
    for (const uri of [
      '/',
      '/index.html',
      '/assets/index-abc.js',
      '/join/x',
      '/joined',
      '/.well-known/assetlinks.json',
    ]) {
      expect(rewrite(uri)).toBe(uri);
    }
  });
});
