import {
  colors,
  contrastRatio,
  lightColors,
  MIN_TEXT_CONTRAST,
  MIN_UI_CONTRAST,
} from '@huntclub/design';
import { SAFETY_NOTE } from '@huntclub/shared';
import { renderPage } from '../render';
import {
  canonicalUrl,
  FOOTER_LINKS,
  GET_THE_APP,
  NAV_LINKS,
  outputFile,
  ROUTES,
  SIGN_IN,
  SITE_ORIGIN,
} from '../routes';
import { MESHTASTIC_ATTRIBUTION } from '../Shell';
import { siteCss } from '../styles';

const FONT = '/assets/Archivo-Latin-test.woff2';
const assets = { fontUrl: FONT, css: siteCss(FONT) };
const pages = ROUTES.map((r) => ({ route: r, html: renderPage(r.path, assets) }));
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

  it('ships no JavaScript (no scripts, no analytics)', () => {
    expect(count(html, /<script/gi)).toBe(0);
  });

  it('preloads the font and has a skip link to the main content', () => {
    expect(html).toContain(`<link rel="preload" as="font" type="font/woff2" href="${FONT}"`);
    expect(html).toContain('<a class="skip-link" href="#main">');
    expect(html).toContain('<main id="main">');
  });

  it('says 911 only in the footer safety note, and credits Meshtastic', () => {
    const footer = html.slice(html.indexOf('<footer'));
    expect(count(textOf(html), /911/g)).toBe(1);
    expect(footer).toContain(SAFETY_NOTE);
    expect(footer).toContain(MESHTASTIC_ATTRIBUTION.replace('®', '®'));
  });

  it('makes no claims the product cannot back', () => {
    const text = textOf(html);
    expect(text).not.toMatch(/shooting hours|night mode|SOS|★|stars?\b|rating|review/i);
    // No range numbers (distances): they depend on terrain and radio.
    expect(text).not.toMatch(/\d+(\.\d+)?\s?(mi|mile|miles|km|kilometers?)\b/i);
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
