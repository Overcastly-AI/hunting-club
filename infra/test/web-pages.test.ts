import {
  ADMIN_PATH,
  BUILD_VERSION_URL,
  CHECKOUT_RETURN_PATHS,
  JOIN_PATH,
  LEGAL_PATHS,
} from '@huntclub/shared/app';
import { MAP_PACKS_PREFIX } from '@huntclub/shared/maps';
import { JOIN_PAGE, NOINDEX_PATHS, outputFile, REDIRECTS, ROUTES } from '@huntclub/site/routes';
import {
  ADMIN_PAGE_OBJECT,
  robotsTxt,
  sitePageObjects,
  webPageRewriteSource,
} from '../src/web-pages';

type Result = { uri: string } | { statusCode: number; headers: { location: { value: string } } };

/** Runs the generated CloudFront Function source on a request URI. */
function run(uri: string): Result {
  const handler = new Function(`${webPageRewriteSource()}\nreturn handler;`)() as (event: {
    request: { uri: string };
  }) => Result;
  return handler({ request: { uri } });
}
const servedAs = (uri: string) => {
  const result = run(uri);
  if (!('uri' in result)) throw new Error(`${uri} redirected`);
  return result.uri;
};
const redirectOf = (uri: string) => {
  const result = run(uri);
  if (!('statusCode' in result)) throw new Error(`${uri} was not redirected`);
  expect(result.statusCode).toBe(301);
  return result.headers.location.value;
};

describe('site and admin routing (CloudFront Function)', () => {
  it('serves every registered site page from its <path>/index.html', () => {
    for (const route of ROUTES) {
      expect(servedAs(route.path)).toBe(`/${outputFile(route.path)}`);
    }
    expect(sitePageObjects()['/']).toBe('/index.html');
  });

  it('serves the admin for /app/ and anything extensionless under it; its files pass through', () => {
    for (const uri of [ADMIN_PATH, '/app/roster', '/app/index.html']) {
      expect(servedAs(uri)).toBe(uri === '/app/index.html' ? uri : ADMIN_PAGE_OBJECT);
    }
    expect(servedAs('/app/assets/index-abc.js')).toBe('/app/assets/index-abc.js');
    expect(servedAs(BUILD_VERSION_URL)).toBe(BUILD_VERSION_URL);
  });

  it('serves the admin for the Checkout return pages', () => {
    for (const uri of Object.values(CHECKOUT_RETURN_PATHS)) {
      expect(servedAs(uri)).toBe(ADMIN_PAGE_OBJECT);
    }
  });

  it('serves the static invite page for /join', () => {
    expect(servedAs(JOIN_PATH)).toBe(`/${JOIN_PAGE.file}`);
  });

  it('serves Privacy and Terms from the public site, at the paths the stores link to', () => {
    for (const uri of Object.values(LEGAL_PATHS)) expect(servedAs(uri)).toBe(`${uri}/index.html`);
  });

  it('redirects old and guessable addresses with a 301', () => {
    for (const [from, to] of Object.entries(REDIRECTS)) expect(redirectOf(from)).toBe(to);
    expect(redirectOf('/index.html')).toBe('/');
    expect(redirectOf('/login')).toBe(ADMIN_PATH);
    expect(redirectOf('/app')).toBe(ADMIN_PATH);
  });

  it('drops a trailing slash with a 301, except on the admin', () => {
    expect(redirectOf('/join/')).toBe(JOIN_PATH);
    expect(redirectOf('/nope//')).toBe('/nope');
    expect(servedAs(ADMIN_PATH)).toBe(ADMIN_PAGE_OBJECT);
  });

  it('sends everything else to S3 unchanged, so a missing path is a real 404', () => {
    for (const uri of [
      '/nope',
      '/joined',
      '/favicon.ico',
      '/favicon.svg',
      '/robots.txt',
      '/sitemap.xml',
      '/404.html',
      '/assets/missing.js',
      '/.well-known/apple-app-site-association',
      `/${MAP_PACKS_PREFIX}club-1/pack.pmtiles`,
    ]) {
      expect(servedAs(uri)).toBe(uri);
    }
  });
});

describe('robots.txt', () => {
  const domainName = 'example.com';

  it('disallows everything on a non-indexable environment', () => {
    expect(robotsTxt({ searchIndexing: false, domainName })).toBe('User-agent: *\nDisallow: /\n');
  });

  it('allows the site, keeps the admin, invites and Checkout out, and points at the sitemap', () => {
    const robots = robotsTxt({ searchIndexing: true, domainName });
    expect(robots.startsWith('User-agent: *\nAllow: /\n')).toBe(true);
    for (const path of NOINDEX_PATHS) expect(robots).toContain(`Disallow: ${path}\n`);
    expect(robots).toContain(`Disallow: ${ADMIN_PATH}\n`);
    expect(robots).toContain(`Sitemap: https://${domainName}/sitemap.xml\n`);
  });
});
