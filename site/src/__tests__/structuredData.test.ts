import { renderJoin, renderNotFound, renderPage } from '../render';
import { PAGE_PATHS, ROUTES, SITE_LOGO, SITE_ORIGIN } from '../routes';
import { jsonLd, STRUCTURED_DATA } from '../structuredData';
import { assets } from './fixtures';

/** The JSON-LD objects in a page. */
const dataIn = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].map(
    (m) => JSON.parse(m[1]!) as Record<string, unknown>,
  );

describe('structured data (JSON-LD)', () => {
  it('describes the organization, site and app on the home page, and the app on Download', () => {
    const types = (path: (typeof ROUTES)[number]['path']) =>
      dataIn(renderPage(path, assets)).map((d) => d['@type']);
    expect(types(PAGE_PATHS.home)).toEqual(['Organization', 'WebSite', 'SoftwareApplication']);
    expect(types(PAGE_PATHS.download)).toEqual(['SoftwareApplication']);
    for (const route of ROUTES) {
      if (!STRUCTURED_DATA[route.path]) expect(types(route.path)).toEqual([]);
    }
    expect(dataIn(renderNotFound(assets))).toEqual([]);
    expect(dataIn(renderJoin(assets, '/assets/join.js'))).toEqual([]);
  });

  it('says the app is free on iOS and Android, with no ratings, reviews or store link', () => {
    const [org, site, app] = dataIn(renderPage(PAGE_PATHS.home, assets));
    expect(org).toMatchObject({ url: SITE_ORIGIN, logo: `${SITE_ORIGIN}/${SITE_LOGO.file}` });
    expect(site).toMatchObject({ url: SITE_ORIGIN });
    expect(app).toMatchObject({
      description: ROUTES[0].description,
      operatingSystem: 'iOS, Android',
      applicationCategory: 'SportsApplication',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    });
    for (const data of Object.values(STRUCTURED_DATA).flat()) {
      expect(JSON.stringify(data)).not.toMatch(/aggregateRating|"review|ratingValue|downloadUrl/i);
    }
  });

  it('cannot end its script tag early', () => {
    expect(jsonLd({ name: '</script><script>alert(1)' })).not.toContain('<');
  });
});
