// @vitest-environment jsdom
// (jsdom only for DOMParser: the pages are still rendered as static HTML strings.)
import {
  colors,
  contrastRatio,
  lightColors,
  MIN_TEXT_CONTRAST,
  MIN_UI_CONTRAST,
  sizes,
  tokenVariables,
} from '@huntclub/design';
import { DAWN_CLASS, DAWN_PAUSE_BUTTON_CLASS } from '@huntclub/design/dawnControl';
import { dawnSceneSvg } from '@huntclub/design/dawnScene';
import {
  CLUB_PRICING,
  dawnPauseCopy,
  LEGAL_DOCS,
  LEGAL_DRAFT_NOTICE,
  SAFETY_NOTE,
} from '@huntclub/shared';
import { ADMIN_PATH, SUPPORT_EMAIL } from '@huntclub/shared/app';
import { renderJoin, renderNotFound, renderPage } from '../render';
import { cspViolations } from '../csp';
import { FAQ, FAQ_PREVIEW } from '../faq';
import { CONDITIONS, FEATURE_GROUPS } from '../features';
import { BETA_POINTS } from '../pages/Download';
import { HERO_ART_SLOT } from '../pages/Home';
import { CLUB_CARD_ORDER } from '../pages/Pricing';
import { assets, CSS, DAWN, FONT, FORWARD_SCRIPT } from './fixtures';
import {
  canonicalUrl,
  CLUB_PRICE_LINE,
  FOOTER_LINKS,
  GET_THE_APP,
  HASH_FORWARD_SCRIPT,
  NAV_LINKS,
  NOINDEX_PATHS,
  NOT_FOUND_PAGE,
  ogImagePath,
  outputFile,
  PAGE_PATHS,
  REDIRECTS,
  ROUTES,
  SIGN_IN,
  SITE_ORIGIN,
  sitemapXml,
  START_A_CLUB,
} from '../routes';
import { MESHTASTIC_ATTRIBUTION } from '../Shell';
import { NARROWEST_PHONE, PHONE_HEADER_MAX_WIDTH, siteCss } from '../styles';

const pages = ROUTES.map((r) => ({ route: r, html: renderPage(r.path, assets) }));
const notFound = renderNotFound(assets);
/** Every HTML file the site builds: the registered pages, 404.html and the /join page. */
const allPages = [
  ...pages.map((p) => ({ name: p.route.path, html: p.html })),
  { name: '404.html', html: notFound },
  { name: 'join/index.html', html: renderJoin(assets, '/assets/join-test.js') },
];
const count = (html: string, pattern: RegExp) => (html.match(pattern) ?? []).length;
/** Visible text only (no tags or inline CSS). */
const textOf = (html: string) =>
  html
    .replace(/<(style|script)[\s\S]*?<\/\1>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');

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

  it('ships no JavaScript except the home page forward and pause script files (no analytics)', () => {
    const home = route.path === '/';
    const data = count(html, /<script type="application\/ld\+json">/g);
    const classic = html.match(/<script src="[^"]*"><\/script>/g) ?? [];
    const modules = html.match(/<script type="module" src="[^"]*">/g) ?? [];
    expect(classic).toEqual(home ? [`<script src="${FORWARD_SCRIPT}"></script>`] : []);
    expect(modules).toEqual(home ? [`<script type="module" src="${DAWN.scriptUrl}">`] : []);
    expect(count(html, /<script/gi)).toBe(classic.length + modules.length + data);
  });

  it('shares a large card at its own absolute URL', () => {
    expect(html).toContain(
      `<meta property="og:image" content="${canonicalUrl(ogImagePath(route.path))}"/>`,
    );
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"/>');
  });
});

describe.each(allPages)('$name', ({ html }) => {
  it('links the stylesheet file and has no inline code the CSP would block', () => {
    expect(html).toContain(`<link rel="stylesheet" href="${CSS}"/>`);
    expect(cspViolations(html)).toEqual([]);
  });

  it('keeps every link and button at the 48 px tap target, except links inside a sentence', () => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const sized = '.button, .tap, .brand, .skip-link, .nav-list a, .menu summary, .faq summary';
    const small = [...doc.querySelectorAll('a, button, summary')].filter(
      (el) => !el.matches(sized) && !el.closest('p'),
    );
    expect(small.map((el) => el.outerHTML)).toEqual([]);
  });

  it('says "last known wind", never a live wind claim', () => {
    const text = textOf(html);
    expect(count(text, /\bwind\b/gi)).toBe(count(text, /\blast known wind\b/gi));
  });

  it('preloads the font and has a skip link to the main content', () => {
    expect(html).toContain(`<link rel="preload" as="font" type="font/woff2" href="${FONT}"`);
    expect(html).toContain('<a class="skip-link" href="#main">');
    expect(html).toContain('<main id="main">');
    expect(count(html, /<h1[\s>]/g)).toBe(1);
  });

  it('says 911 only in the safety note (footer, and Terms), and credits Meshtastic', () => {
    const footer = html.slice(html.indexOf('<footer'));
    const text = textOf(html);
    expect(count(text, /911/g)).toBe(text.split(SAFETY_NOTE).length - 1);
    expect(footer).toContain(SAFETY_NOTE);
    expect(footer).toContain(MESHTASTIC_ATTRIBUTION);
  });

  it('makes no claims the product cannot back', () => {
    const text = textOf(html);
    expect(text).not.toMatch(/shooting hours|night mode|SOS|★|stars?\b|rating|\breviews\b/i);
    // No placeholder prices or unfinished copy, and no store badges before the listings.
    expect(text).not.toMatch(
      /\bTBD\b|\$TBD|App Store badge|Download on the App Store|Get it on Google Play/i,
    );
    expect(html).not.toMatch(/apps\.apple\.com|play\.google\.com|testflight\.apple\.com/);
    // No range numbers (distances): they depend on terrain and radio.
    expect(text).not.toMatch(/\d+(\.\d+)?\s?(mi|mile|miles|km|kilometers?)\b/i);
  });
});

describe('404 page', () => {
  it('has the shared header and footer, with the site nav', () => {
    const header = notFound.slice(notFound.indexOf('<header'), notFound.indexOf('</header>'));
    for (const link of [...NAV_LINKS, SIGN_IN]) {
      expect(header).toContain(`<a href="${link.href}">${link.label}</a>`);
    }
    expect(notFound).toContain('<a class="brand" href="/">');
    const footer = notFound.slice(notFound.indexOf('<footer'));
    for (const link of FOOTER_LINKS) expect(footer).toContain(`href="${link.href}"`);
  });

  it('is noindex with no canonical URL, and offers a way home and to sign in', () => {
    expect(notFound).toContain('<meta name="robots" content="noindex"/>');
    expect(notFound).not.toContain('rel="canonical"');
    expect(notFound).toContain(`<title>${NOT_FOUND_PAGE.title}</title>`);
    expect(notFound).toContain('<a class="button primary" href="/">Go to the home page</a>');
    expect(notFound).toContain(`<a class="button" href="${ADMIN_PATH}">`);
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

  it('point only at registered pages, sections that exist, or the admin', () => {
    const allowed = new Set<string>([...ROUTES.map((r) => r.path), ADMIN_PATH]);
    for (const link of [...NAV_LINKS, GET_THE_APP, SIGN_IN, START_A_CLUB, ...FOOTER_LINKS]) {
      expect(allowed.has(link.href)).toBe(true);
    }
  });

  it('show the nav in the header, and again in a "Menu" disclosure for phones', () => {
    const header = home.slice(home.indexOf('<header'), home.indexOf('</header>'));
    for (const link of [...NAV_LINKS, SIGN_IN]) {
      expect(count(header, new RegExp(`<a href="${link.href}">${link.label}</a>`, 'g'))).toBe(2);
    }
    expect(home).toContain('<details class="menu"><summary>Menu</summary>');
    // On phones the main action moves into the menu.
    const menu = header.slice(header.indexOf('<details'));
    expect(menu).toContain(`<a href="${GET_THE_APP.href}">${GET_THE_APP.label}</a>`);
  });
});

describe('phone first', () => {
  const css = siteCss(FONT);
  const phoneRules = css.slice(css.indexOf(`@media (max-width: ${PHONE_HEADER_MAX_WIDTH}px)`));

  it('collapses the header to the logo and one Menu button', () => {
    expect(phoneRules).toMatch(
      /^[^}]*\.site-header \.desktop, \.site-header \.header-action \{ display: none; \}/,
    );
    expect(phoneRules).toMatch(/^[^}]*\}\s*\.menu \{ display: block; \}/);
  });

  it('gives every sized link and control the 48 px tap target', () => {
    expect(sizes.minTapTarget).toBe(48);
    for (const selector of [
      '.button',
      '.tap',
      '.brand',
      '.skip-link',
      '.nav-list a',
      '.menu summary',
    ]) {
      const escaped = selector.replace(/\./g, '\\.');
      expect(css).toMatch(new RegExp(`(^|\\n)${escaped} \\{[^}]*min-height: var\\(--tap-min\\)`));
    }
    expect(css).toMatch(/\.faq summary \{[^}]*min-height: 56px/);
  });

  it('fits a 360 px phone: no grid column is wider than the screen less its gutters', () => {
    const gutters = 2 * 16; // .wrap padding: --space-md each side
    const columns = [...css.matchAll(/minmax\(([\d.]+)rem/g)].map((m) => Number(m[1]) * 16);
    expect(columns.length).toBeGreaterThan(0);
    for (const px of columns) expect(px).toBeLessThanOrEqual(NARROWEST_PHONE - gutters);
    expect(tokenVariables()['--space-md']).toBe('16px');
  });
});

describe('light sections', () => {
  const css = siteCss(FONT);
  const vars = tokenVariables();
  const bg = lightColors.bgLight;
  /** Innermost rules (inside media queries too), as selector and declarations. */
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1]!.trim(),
    body: m[2]!,
  }));
  const colorOf = (body: string, property: string) =>
    new RegExp(`(?:^|[;{]|\\s)${property}:[^;]*var\\((--color-[a-z-]+)\\)`).exec(body)?.[1];

  it('hold every color a light band sets to 4.5:1 (text) or 3:1 (borders, focus ring)', () => {
    const light = rules.filter((r) => r.selector.includes('.band-light'));
    expect(light.length).toBeGreaterThan(5);
    for (const { selector, body } of light) {
      // Text sits on the rule's own background when it sets one (the primary button).
      const ground = colorOf(body, 'background');
      const text = colorOf(body, 'color');
      if (text) {
        expect([selector, contrastRatio(vars[text]!, ground ? vars[ground]! : bg)]).toEqual([
          selector,
          expect.toSatisfy((r: number) => r >= MIN_TEXT_CONTRAST),
        ]);
      }
      for (const edge of ['border-color', 'outline-color']) {
        const color = colorOf(body, edge);
        if (color) {
          expect([selector, edge, contrastRatio(vars[color]!, bg)]).toEqual([
            selector,
            edge,
            expect.toSatisfy((r: number) => r >= MIN_UI_CONTRAST),
          ]);
        }
      }
    }
  });

  it('draw the borders of parts used in light bands at 3:1 or better', () => {
    // FAQ rows, the comparison table and screenshot frames sit on light bands.
    for (const selector of ['.faq details', '.compare th, .compare td', '.shot-frame']) {
      const rule = rules.find((r) => r.selector === selector);
      const border = rule && colorOf(rule.body, 'border(?:-bottom)?');
      expect(border).toBeDefined();
      expect(contrastRatio(vars[border!]!, bg)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
    }
  });

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

describe('page content', () => {
  const page = (path: string) => pages.find((p) => p.route.path === path)!.html;
  /** Every href on a page, in its body (not the head's canonical and icons). */
  const hrefs = (html: string) =>
    [...html.slice(html.indexOf('<body')).matchAll(/href="([^"]*)"/g)].map((m) => m[1]!);

  it('links within the site only to registered pages, home sections, the admin or mail', () => {
    const allowed = new Set<string>([...ROUTES.map((r) => r.path), ADMIN_PATH]);
    for (const { html } of pages) {
      for (const href of hrefs(html)) {
        if (href.startsWith('mailto:')) continue;
        const [path = '', id] = href.split('#');
        if (id) {
          // An anchor: on this page, or on a registered page that has that id.
          if (path) expect(page(path)).toContain(`id="${id}"`);
          else expect(html).toContain(`id="${id}"`);
        } else expect(allowed.has(href)).toBe(true);
      }
    }
  });

  it('shows the club price, trial and terms from CLUB_PRICING on Pricing and Clubs', () => {
    const { intervals } = CLUB_PRICING;
    expect(CLUB_PRICE_LINE).toBe('$10/month or $100/year (save $20)');
    const html = page(PAGE_PATHS.pricing);
    const pricing = textOf(html);
    expect(pricing).toContain(`${CLUB_PRICE_LINE} per club`);
    expect(pricing).toContain('$0');
    // Two equal cards, monthly then yearly, each with its trial line and "per club" first.
    const cards = [...html.matchAll(/<div class="card"><h2>Club, [\s\S]*?<\/div>/g)].map((m) =>
      textOf(m[0]),
    );
    expect(cards).toHaveLength(2);
    CLUB_CARD_ORDER.forEach((interval, i) => {
      const card = cards[i]!;
      expect(card).toContain(intervals[interval].price);
      expect(card).toContain(intervals[interval].trial);
      expect(card.slice(card.indexOf(intervals[interval].price))).toMatch(/^[^.]*\.?[^.]*Per club/);
      expect(card).toContain(CLUB_PRICING.cta);
    });
    expect(cards[1]).toContain(`(${intervals.year.savings})`);
    const clubs = textOf(page(PAGE_PATHS.clubs));
    expect(clubs).toContain(`One price per club: ${CLUB_PRICE_LINE}`);
    expect(clubs).toContain(CLUB_PRICING.terms);
    for (const path of [PAGE_PATHS.pricing, PAGE_PATHS.clubs]) {
      expect(page(path)).toContain(
        `<a class="button primary" href="${ADMIN_PATH}">${CLUB_PRICING.cta}</a>`,
      );
    }
  });

  it('says plainly on Download what beta means and what to do next, with no store links', () => {
    const html = page(PAGE_PATHS.download);
    const download = textOf(html);
    expect(download).toMatch(/is in beta\. It is not in the App Store or Google Play yet/);
    expect(download).toContain('What beta means');
    for (const point of BETA_POINTS) expect(download).toContain(point);
    expect(download).toContain('What to do now');
    expect(html).toContain(`<a class="button primary" href="${PAGE_PATHS.contact}">`);
    expect(download).toMatch(/Meshtastic radio with GPS/);
  });

  it('words the conditions line one way everywhere: "last known wind"', () => {
    expect(CONDITIONS).toMatch(/^Last known wind/);
    expect(textOf(page(PAGE_PATHS.pricing))).toContain(CONDITIONS);
  });

  it('shows Privacy and Terms from the shared copy, marked as drafts', () => {
    for (const [path, doc] of [
      [PAGE_PATHS.privacy, LEGAL_DOCS.privacy],
      [PAGE_PATHS.terms, LEGAL_DOCS.terms],
    ] as const) {
      const html = page(path);
      expect(html).toContain(`<h1>${doc.title}</h1>`);
      expect(html).toContain(`<p class="notice" role="note">${LEGAL_DRAFT_NOTICE}</p>`);
      for (const section of doc.sections) expect(html).toContain(`<h2>${section.heading}</h2>`);
    }
  });

  it('gives the support email on Contact once there is one, and says it is coming until then', () => {
    const contact = page(PAGE_PATHS.contact);
    if (SUPPORT_EMAIL) expect(contact).toContain(`href="mailto:${SUPPORT_EMAIL}"`);
    else {
      expect(textOf(contact)).toMatch(/support email address is coming soon/);
      expect(contact).not.toContain('mailto:');
    }
  });
});

describe('features and FAQ', () => {
  const page = (path: string) => pages.find((p) => p.route.path === path)!.html;

  it('gives every feature group an anchor, words for Free and Club, and a sized placeholder', () => {
    const features = page(PAGE_PATHS.features);
    const ids = FEATURE_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const group of FEATURE_GROUPS) {
      expect(group.free ?? group.club).toBeTruthy();
      expect(features).toContain(`id="${group.id}"`);
      expect(features).toContain(`aria-label="Screenshot coming soon: ${group.shot.label}"`);
    }
    expect(features).toContain('<strong>Free:</strong>');
    expect(features).toContain('<strong>Club:</strong>');
    expect(features).not.toMatch(/<img/);
  });

  it('answers every question on /faq, the emergency one with the safety note word for word', () => {
    const faq = textOf(page(PAGE_PATHS.faq));
    for (const item of FAQ) {
      expect(faq).toContain(item.q);
      expect(faq).toContain(item.a);
    }
    expect(FAQ.find((i) => /emergency/.test(i.q))?.a).toContain(SAFETY_NOTE);
    const home = textOf(page('/'));
    for (const item of FAQ_PREVIEW) expect(home).toContain(item.q);
  });

  it('puts the dawn scene behind the home hero only, with its stylesheet and pause button', () => {
    const home = page('/');
    const hero = home.slice(home.indexOf('<section class="hero">'), home.indexOf('</section>'));
    expect(hero).toContain(
      `<div class="${HERO_ART_SLOT}" aria-hidden="true">${dawnSceneSvg()}</div>`,
    );
    expect(hero).toContain(
      `<button class="button ${DAWN_PAUSE_BUTTON_CLASS}" type="button" aria-pressed="false" hidden="">${dawnPauseCopy.pause}</button>`,
    );
    expect(home).toContain(`<link rel="stylesheet" href="${DAWN.cssUrl}"/>`);
    // The headline stays the largest content (LCP): the scene is decorative SVG, not an image.
    expect(hero).not.toMatch(/<img|<image|<video|fetchpriority/);
    for (const { route, html } of pages.filter((p) => p.route.path !== '/')) {
      expect([route.path, html.includes(`class="${DAWN_CLASS}"`)]).toEqual([route.path, false]);
      expect(html).not.toContain(DAWN.cssUrl);
      expect(html).not.toContain(DAWN_PAUSE_BUTTON_CLASS);
    }
  });
});
