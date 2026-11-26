import {
  colors,
  contrastRatio,
  lightColors,
  MIN_TEXT_CONTRAST,
  MIN_UI_CONTRAST,
} from '@huntclub/design';
import { SAFETY_NOTE } from '@huntclub/shared';
import { renderNotFound, renderPage } from '../render';
import {
  canonicalUrl,
  FOOTER_LINKS,
  GET_THE_APP,
  HASH_FORWARD_SCRIPT,
  NAV_LINKS,
  NOINDEX_PATHS,
  NOT_FOUND_PAGE,
  outputFile,
  REDIRECTS,
  ROUTES,
  SIGN_IN,
  SITE_ORIGIN,
  sitemapXml,
} from '../routes';
import { MESHTASTIC_ATTRIBUTION } from '../Shell';
import { siteCss } from '../styles';

const FONT = '/assets/Archivo-Latin-test.woff2';
const assets = { fontUrl: FONT, css: siteCss(FONT) };
const pages = ROUTES.map((r) => ({ route: r, html: renderPage(r.path, assets) }));
const notFound = renderNotFound(assets);
/** Every HTML file the site builds: the registered pages and 404.html. */
const allPages = [
  ...pages.map((p) => ({ name: p.route.path, html: p.html })),
  { name: '404.html', html: notFound },
];
const count = (html: string, pattern: RegExp) => (html.match(pattern) ?? []).length;
/** Visible text only (no tags or inline CSS). */
const textOf = (html: string) =>
  html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');

describe('route registry', () => {
  it('has unique, well-formed paths', () => {
    const paths = ROUTES.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) expect(path).toMatch(/^\/([a-z0-9-]+(\/[a-z0-9-]+)*)?$/);
    expect(paths).toContain('/');
  });

  it.each(ROUTES)(
    '$path has a title of at most 60 and a description of 70 to 160 characters',
    (r) => {
      expect(r.title.length).toBeLessThanOrEqual(60);
      expect(r.description.length).toBeGreaterThanOrEqual(70);
      expect(r.description.length).toBeLessThanOrEqual(160);
    },
  );

  it('writes each page to <path>/index.html', () => {
    expect(outputFile('/')).toBe('index.html');
    expect(outputFile('/clubs')).toBe('clubs/index.html');
  });
});

describe.each(pages)('page $route.path', ({ route, html }) => {
  it('is a complete document with one H1, the canonical URL and Open Graph meta', () => {
    expect(html.startsWith('<!doctype html><html lang="en">')).toBe(true);
    expect(count(html, /<h1[\s>]/g)).toBe(1);
    expect(html).toContain(`<link rel="canonical" href="${canonicalUrl(route.path)}"/>`);
    expect(canonicalUrl(route.path).startsWith(SITE_ORIGIN)).toBe(true);
    expect(html).toContain(`<title>${route.title}</title>`);
    for (const property of ['og:title', 'og:description', 'og:url', 'og:type', 'og:site_name']) {
      expect(html).toContain(`property="${property}"`);
    }
  });

  it('ships no JavaScript except the old-bookmark forward on the home page (no analytics)', () => {
    const scripts = html.match(/<script>[\s\S]*?<\/script>/g) ?? [];
    expect(scripts).toEqual(route.path === '/' ? [`<script>${HASH_FORWARD_SCRIPT}</script>`] : []);
    expect(count(html, /<script/gi)).toBe(scripts.length);
  });
});

describe.each(allPages)('$name', ({ html }) => {
  it('preloads the font and has a skip link to the main content', () => {
    expect(html).toContain(`<link rel="preload" as="font" type="font/woff2" href="${FONT}"`);
    expect(html).toContain('<a class="skip-link" href="#main">');
    expect(html).toContain('<main id="main">');
    expect(count(html, /<h1[\s>]/g)).toBe(1);
  });

  it('says 911 only in the footer safety note, and credits Meshtastic', () => {
    const footer = html.slice(html.indexOf('<footer'));
    expect(count(textOf(html), /911/g)).toBe(1);
    expect(footer).toContain(SAFETY_NOTE);
    expect(footer).toContain(MESHTASTIC_ATTRIBUTION);
  });

  it('makes no claims the product cannot back', () => {
    const text = textOf(html);
    expect(text).not.toMatch(/shooting hours|night mode|SOS|★|stars?\b|rating|review/i);
    // No range numbers (distances): they depend on terrain and radio.
    expect(text).not.toMatch(/\d+(\.\d+)?\s?(mi|mile|miles|km|kilometers?)\b/i);
  });
});

describe('404 page', () => {
  it('is noindex with no canonical URL, and offers a way home and to sign in', () => {
    expect(notFound).toContain('<meta name="robots" content="noindex"/>');
    expect(notFound).not.toContain('rel="canonical"');
    expect(notFound).toContain(`<title>${NOT_FOUND_PAGE.title}</title>`);
    expect(notFound).toContain('<a class="button primary" href="/">Go to the home page</a>');
    expect(notFound).toContain(`href="${SIGN_IN.href}"`);
    expect(count(notFound, /<script/gi)).toBe(0);
  });
});

describe('hosting data', () => {
  it('lists every registered page in sitemap.xml, and nothing that is noindex', () => {
    const xml = sitemapXml('2026-11-26');
    for (const route of ROUTES) {
      expect(xml).toContain(`<loc>${canonicalUrl(route.path)}</loc><lastmod>2026-11-26</lastmod>`);
    }
    for (const path of NOINDEX_PATHS) expect(xml).not.toContain(`${SITE_ORIGIN}${path}<`);
  });

  it('redirects only to registered pages or the admin, and never from one', () => {
    const paths = new Set<string>(ROUTES.map((r) => r.path));
    for (const [from, to] of Object.entries(REDIRECTS)) {
      expect(paths.has(from)).toBe(false);
      expect(paths.has(to) || to === SIGN_IN.href).toBe(true);
    }
  });

  it('forwards only #/ admin bookmarks to the admin', () => {
    const forward = (hash: string) => {
      let to: string | undefined;
      new Function('location', HASH_FORWARD_SCRIPT)({ hash, replace: (u: string) => (to = u) });
      return to;
    };
    expect(forward('#/roster')).toBe(`${SIGN_IN.href}#/roster`);
    expect(forward('#features')).toBeUndefined();
    expect(forward('')).toBeUndefined();
  });
});

describe('links', () => {
  const home = pages.find((p) => p.route.path === '/')!.html;

  it('point only at registered pages, sections that exist, or the admin and legal pages', () => {
    const allowed = new Set<string>([
      ...ROUTES.map((r) => r.path),
      SIGN_IN.href,
      ...FOOTER_LINKS.map((l) => l.href),
    ]);
    for (const link of [...NAV_LINKS, GET_THE_APP, SIGN_IN, ...FOOTER_LINKS]) {
      const [path, id] = link.href.split('#');
      if (id) {
        expect(path).toBe('/');
        expect(home).toContain(`id="${id}"`);
      } else {
        expect(allowed.has(link.href)).toBe(true);
      }
    }
  });

  it('show the nav in the header, and again in a "Menu" disclosure for phones', () => {
    for (const link of [...NAV_LINKS, SIGN_IN]) {
      expect(count(home, new RegExp(`<a href="${link.href}">${link.label}</a>`, 'g'))).toBe(2);
    }
    expect(home).toContain('<details class="menu"><summary>Menu</summary>');
  });
});

describe('light sections', () => {
  it('pair text and links with the light background at 4.5:1 or better', () => {
    for (const fg of [lightColors.textOnLight, lightColors.mutedOnLight, lightColors.linkOnLight]) {
      expect(contrastRatio(fg, lightColors.bgLight)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
  });

  it('keep the primary button readable and its outline visible on a light band', () => {
    expect(contrastRatio(colors.surface, colors.accent)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    expect(contrastRatio(lightColors.textOnLight, lightColors.bgLight)).toBeGreaterThanOrEqual(
      MIN_UI_CONTRAST,
    );
  });

  it('use only tokens: no hex colors outside the generated variables', () => {
    const css = siteCss(FONT);
    const rules = css.slice(css.indexOf('* {'));
    expect(rules).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
