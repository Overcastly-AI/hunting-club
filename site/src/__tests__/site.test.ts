// @vitest-environment jsdom
// (jsdom only for DOMParser: the pages are still rendered as static HTML strings.)
import { AERIAL_WORLD } from '@huntclub/design/aerial';
import {
  breakpoints,
  contrastRatio,
  DAYLIGHT_BODY_TOKENS,
  fontSize,
  MIN_DAYLIGHT_BODY_CONTRAST,
  MIN_TEXT_CONTRAST,
  MIN_UI_CONTRAST,
  PHONE_MEDIA,
  rem,
  ROOT_FONT_PX,
  SAFE_AREA,
  sizes,
  themes,
  themeVariables,
  tokenVariables,
} from '@huntclub/design';
import {
  CLUB_PRICING,
  describeFreshness,
  FRESHNESS_THRESHOLDS_MS,
  LEGAL_DOCS,
  LEGAL_DRAFT_NOTICE,
  MINUTE_MS,
  SAFETY_NOTE,
  SECOND_MS,
} from '@huntclub/shared';
import { ADMIN_PATH, SUPPORT_EMAIL, VIEWPORT_META } from '@huntclub/shared/app';
import { renderJoin, renderNotFound, renderPage } from '../render';
import { cspViolations } from '../csp';
import { FAQ, FAQ_PREVIEW } from '../faq';
import { CONDITIONS, FEATURE_GROUPS, planWord } from '../features';
import {
  HERO_HEIGHT,
  MAP_COVERED_WIDTH,
  MAP_FRAME,
  MAP_PHONE_MAX_WIDTH,
  mapCss,
} from '../map/mapCss';
import { AT, MAP_DESCRIPTION, READOUT_LABELS, RING_CLASS } from '../map/MapView';
import {
  hunterFreshness,
  openStands,
  SAMPLE_CLUB,
  SAMPLE_CONDITIONS,
  SAMPLE_MESH,
} from '../map/sampleClub';
import { BETA_POINTS } from '../pages/Download';
import { HOME_PROMISE, LEGEND } from '../pages/Home';
import { CLUB_ALTERNATIVE, CLUB_AMOUNT, CLUB_UNIT, COMPARISON } from '../pages/Pricing';
import { AERIAL, assets, CSS, FONT, FORWARD_SCRIPT, MENU_SCRIPT } from './fixtures';
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
  THEME_COLOR,
} from '../routes';
import { MESHTASTIC_ATTRIBUTION } from '../Shell';
import {
  MENU_LABELS,
  MENU_OPEN_CLASS,
  MENU_SHEET_ID,
  MENU_TOGGLE_CLASS,
  PHONE_HEADER_HEIGHT,
  PHONE_HEADER_MEDIA,
} from '../menu/menu';
import {
  CONTENT_MAX_WIDTH,
  FEATURE_COLUMNS_MIN_WIDTH,
  GUTTER,
  NARROW_MAX_WIDTH,
  NARROWEST_PHONE,
  siteCss,
  SIZED_CONTROLS,
} from '../styles';

const pages = ROUTES.map((r) => ({ route: r, html: renderPage(r.path, assets) }));
const notFound = renderNotFound(assets);
/** Every HTML file the site builds: the registered pages, 404.html and the /join page. */
const allPages = [
  ...pages.map((p) => ({ name: p.route.path, html: p.html })),
  { name: '404.html', html: notFound },
  { name: 'join/index.html', html: renderJoin(assets, '/assets/join-test.js') },
];
const page = (path: string) => pages.find((p) => p.route.path === path)!.html;
const count = (html: string, pattern: RegExp) => (html.match(pattern) ?? []).length;
/** Visible text only (no tags or inline CSS). */
const textOf = (html: string) =>
  html
    .replace(/<(style|script)[\s\S]*?<\/\1>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
const css = siteCss(FONT);
/** Innermost rules (inside media queries too), as selector and declarations. */
const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(
  (m) => ({
    selector: m[1]!.trim(),
    body: m[2]!,
  }),
);

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

  it('ships no JavaScript but the header menu and the home bookmark forward (no analytics)', () => {
    const home = route.path === '/';
    const data = count(html, /<script type="application\/ld\+json">/g);
    const classic = html.match(/<script src="[^"]*"><\/script>/g) ?? [];
    const modules = html.match(/<script type="module" src="[^"]*"><\/script>/g) ?? [];
    expect(classic).toEqual(home ? [`<script src="${FORWARD_SCRIPT}"></script>`] : []);
    expect(modules).toEqual([`<script type="module" src="${MENU_SCRIPT}"></script>`]);
    expect(count(html, /<script/gi)).toBe(classic.length + modules.length + data);
  });

  it("fits the iPhone's whole screen with the admin's own viewport, keeping clear of the notch", () => {
    expect(html).toContain(`<meta name="viewport" content="${VIEWPORT_META}"/>`);
    expect(css).toContain(
      `body { padding: 0 ${SAFE_AREA.right} ${SAFE_AREA.bottom} ${SAFE_AREA.left}; }`,
    );
  });

  it('colours the browser bar like the header, in each theme', () => {
    expect(html).toContain(
      `<meta name="theme-color" content="${THEME_COLOR.dark}" media="(prefers-color-scheme: dark)"/>`,
    );
    expect(html).toContain(
      `<meta name="theme-color" content="${THEME_COLOR.light}" media="(prefers-color-scheme: light)"/>`,
    );
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
    const sized = SIZED_CONTROLS.join(', ');
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
    expect(header).not.toContain('aria-current');
    expect(notFound).toContain('<a class="brand" href="/">');
    const footer = notFound.slice(notFound.indexOf('<footer'));
    for (const link of FOOTER_LINKS) expect(footer).toContain(`href="${link.href}"`);
  });

  it('is noindex with no canonical URL, and offers a way home and to sign in', () => {
    expect(notFound).toContain('<meta name="robots" content="noindex"/>');
    expect(notFound).not.toContain('rel="canonical"');
    expect(notFound).toContain(`<title>${NOT_FOUND_PAGE.title}</title>`);
    expect(notFound).toContain('<a class="btn go" href="/">Go to the home page</a>');
    expect(notFound).toContain(`<a class="btn" href="${ADMIN_PATH}">`);
    // Only the header menu's script.
    expect(notFound.match(/<script[^>]*>/g)).toEqual([
      `<script type="module" src="${MENU_SCRIPT}">`,
    ]);
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

  it('show the nav in the header, and again in a Menu sheet for phones', () => {
    const header = home.slice(home.indexOf('<header'), home.indexOf('</header>'));
    const toggleAt = header.indexOf(`<button type="button" class="${MENU_TOGGLE_CLASS}"`);
    const menu = header.slice(toggleAt);
    for (const link of [...NAV_LINKS, SIGN_IN, GET_THE_APP]) {
      expect(header.slice(0, toggleAt)).toContain(`href="${link.href}"`);
      expect(menu).toContain(`<a href="${link.href}">${link.label}</a>`);
    }
    // A real button naming what it controls; the sheet stays closed until the script opens it.
    expect(home).toContain(
      `<button type="button" class="${MENU_TOGGLE_CLASS}" aria-expanded="false" aria-controls="${MENU_SHEET_ID}">${MENU_LABELS.closed}</button>`,
    );
    expect(home).toContain(`<nav id="${MENU_SHEET_ID}" aria-label="Main menu" hidden="">`);
    expect(header).toContain(
      `<a class="btn go" href="${GET_THE_APP.href}">${GET_THE_APP.label}</a>`,
    );
  });

  it("marks the current page in the header's nav", () => {
    for (const link of NAV_LINKS) {
      expect(page(link.href)).toContain(
        `<a href="${link.href}" aria-current="page">${link.label}</a>`,
      );
    }
    expect(count(home, /aria-current/g)).toBe(0);
  });
});

describe('page content', () => {
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
    expect([CLUB_AMOUNT, CLUB_UNIT]).toEqual(['$100', '/year per club']);
    expect(CLUB_ALTERNATIVE).toBe(`${intervals.year.badge}, or ${intervals.month.price}.`);
    const html = page(PAGE_PATHS.pricing);
    const club = textOf(html.slice(html.indexOf('<h2>Club</h2>'), html.indexOf('<table')));
    expect(club).toContain(`${CLUB_AMOUNT} ${CLUB_UNIT}`);
    expect(club).toContain(CLUB_ALTERNATIVE);
    expect(club).toContain(CLUB_PRICING.cta);
    expect(club).toContain(CLUB_PRICING.terms);
    expect(textOf(html)).toContain('$0');
    const clubs = textOf(page(PAGE_PATHS.clubs));
    expect(clubs).toContain(`One price per club: ${CLUB_PRICE_LINE}`);
    expect(clubs).toContain(CLUB_PRICING.terms);
    expect(textOf(page('/'))).toContain(`${CLUB_PRICE_LINE} per club`);
    for (const path of [PAGE_PATHS.pricing, PAGE_PATHS.clubs]) {
      expect(page(path)).toContain(
        `<a class="btn go" href="${ADMIN_PATH}">${CLUB_PRICING.cta}</a>`,
      );
    }
  });

  it('compares the plans in one table, with a tick and a word for every yes', () => {
    const doc = new DOMParser().parseFromString(page(PAGE_PATHS.pricing), 'text/html');
    const table = doc.querySelector('table.compare')!;
    expect([...table.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual([
      'Feature',
      'Free',
      'Club',
    ]);
    const rows = COMPARISON.flatMap((g) => g.rows);
    const body = [...table.querySelectorAll('tbody tr:not(.group)')];
    expect(body).toHaveLength(rows.length);
    rows.forEach((row, i) => {
      const cells = [...body[i]!.querySelectorAll('td')];
      expect(body[i]!.querySelector('th')!.textContent).toBe(row.feature);
      [row.free, row.club].forEach((value, j) => {
        const cell = cells[j]!;
        const words: Record<string, string> = { yes: 'Yes', no: 'No' };
        expect(cell.textContent).toBe(words[value] ?? value);
        expect(cell.querySelector('.lucide-check') !== null).toBe(value === 'yes');
      });
    });
    expect([...table.querySelectorAll('.group th')].map((th) => th.textContent)).toEqual(
      COMPARISON.map((g) => g.group),
    );
    // Short words only: on a phone each plan column is 76 px.
    for (const row of rows) {
      for (const v of [row.free, row.club]) expect(v.length).toBeLessThanOrEqual(11);
    }
  });

  it('says plainly on Download what beta means and what to do next, with no store links', () => {
    const html = page(PAGE_PATHS.download);
    const download = textOf(html);
    expect(download).toMatch(/is in beta\. It is not in the App Store or Google Play yet/);
    expect(download).toContain('What beta means');
    for (const point of BETA_POINTS) expect(download).toContain(point);
    expect(download).toContain('What to do now');
    expect(html).toContain(`<a class="btn go" href="${PAGE_PATHS.contact}">`);
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

  it('lists every feature on the home page in one sentence, with its plan in words', () => {
    const html = page('/');
    const home = textOf(html);
    for (const group of FEATURE_GROUPS) {
      expect(group.summary).toMatch(/^[^.;!?]+\.$/);
      expect(home).toContain(group.summary);
      expect(html).toContain(`href="${PAGE_PATHS.features}#${group.id}">${group.title}</a>`);
      expect(html).toContain(`<span class="plan-word">${planWord(group)}</span>`);
    }
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
});

describe('home page map', () => {
  const home = page('/');
  const doc = new DOMParser().parseFromString(home, 'text/html');
  const hero = doc.querySelector('section.hero.mapview')!;

  it('is the hero: the aerial picture file with the example club, one image to a screen reader', () => {
    expect(hero).not.toBeNull();
    expect(hero.querySelector('h1')).not.toBeNull();
    const world = hero.querySelector('.world')!;
    expect(world.getAttribute('role')).toBe('img');
    expect(world.getAttribute('aria-label')).toBe(MAP_DESCRIPTION);
    expect(world.querySelector('img')!.outerHTML).toBe(
      `<img class="world-map" src="${AERIAL}" width="2000" height="1400" alt="">`,
    );
    expect(textOf(hero.outerHTML)).toContain('Example club');
    // The map is only on the home page, and no page carries an illustration.
    for (const { route, html } of pages.filter((p) => p.route.path !== '/')) {
      expect([route.path, html.includes(AERIAL)]).toEqual([route.path, false]);
    }
    for (const { name, html } of allPages) {
      expect([name, /class="dawn|dawn-pause|hero-art/.test(html)]).toEqual([name, false]);
    }
  });

  it('rings each hunter by how fresh their position is, and says how long ago on the plate', () => {
    const markers = [...hero.querySelectorAll('.mk.hunter')];
    expect(markers).toHaveLength(SAMPLE_CLUB.hunters.length);
    SAMPLE_CLUB.hunters.forEach((h, i) => {
      const heard = hunterFreshness(h);
      const marker = markers[i]!;
      expect(marker.classList.contains(RING_CLASS[heard.freshness])).toBe(true);
      expect(marker.classList.contains(AT.hunter(i))).toBe(true);
      expect(marker.querySelector('.tag')!.textContent).toBe(`${h.where}${h.name}, ${heard.short}`);
    });
    // The sample shows both kinds of ring; a stale position is never drawn solid.
    const kinds = SAMPLE_CLUB.hunters.map((h) => hunterFreshness(h).freshness);
    expect(kinds).toContain('fresh');
    expect(kinds).toContain('stale');
    expect(css).toMatch(
      /\.mk\.ring-stale \.dot, \.mk\.ring-faded \.dot \{[^}]*border-style: dashed/,
    );
    expect(hero.querySelectorAll('.mk.stand')).toHaveLength(openStands().length);
    expect(hero.querySelectorAll('.mk.you')).toHaveLength(1);
  });

  it('places every marker and label with a class from the stylesheet, never a style attribute', () => {
    for (const el of hero.querySelectorAll('.world .mk, .world .lbl')) {
      const at = [...el.classList].find((c) => c.startsWith('at-'));
      expect(at).toBeDefined();
      expect(css).toMatch(new RegExp(`\\.${at} \\{ left: \\d+px; top: \\d+px;`));
    }
  });

  it('reads out sunrise, sunset, the last known wind and the temperature, and the mesh', () => {
    const cells = [...hero.querySelectorAll('.fields .field')].map((f) => [
      f.querySelector('dt')!.textContent,
      f.querySelector('dd')!.textContent,
    ]);
    const joined = (s: string) => s.replace(/ (AM|PM|mph)$/, '$1');
    expect(cells).toEqual([
      [READOUT_LABELS.sunrise, joined(SAMPLE_CONDITIONS.sunrise)],
      [READOUT_LABELS.sunset, joined(SAMPLE_CONDITIONS.sunset)],
      [READOUT_LABELS.wind, joined(SAMPLE_CONDITIONS.wind.short)],
      [READOUT_LABELS.temperature, SAMPLE_CONDITIONS.temperature.short],
    ]);
    expect(READOUT_LABELS.wind).toBe('Last known wind');
    expect(textOf(hero.outerHTML)).toContain(`${SAMPLE_MESH.heard.short}. No internet in use.`);
    expect(SAMPLE_MESH.heard.short).toBe(
      describeFreshness(MINUTE_MS, MINUTE_MS + 12 * SECOND_MS, 'heard').short,
    );
    // Sunrise and sunset only: no derived shooting times.
    expect(textOf(hero.outerHTML)).not.toMatch(/first light|last light|legal/i);
  });

  it('frames the club differently on a phone, inside a window that clips the aerial', () => {
    expect(css).toMatch(/\.mapview \{[^}]*overflow: hidden/);
    const [wx, wy] = MAP_FRAME.wide;
    const [px, py] = MAP_FRAME.phone;
    expect(css).toContain(
      `.world { position: absolute; left: max(-${wx}px, calc(100% - ${AERIAL_WORLD.width}px)); top: -${wy}px;`,
    );
    const phone = css.slice(css.indexOf(`@media (max-width: ${MAP_PHONE_MAX_WIDTH}px)`));
    expect(phone).toContain(`.world { left: -${px}px; top: -${py}px; }`);
  });

  it('keeps the map hero full-bleed: the framed aerial reaches both edges at every width', () => {
    const { width, height } = AERIAL_WORLD;
    // Wide frame: the window's left edge is wx into the aerial, or less once the window is
    // wider than the rest of the picture (left: max(-wx, 100% - width)), up to 1920 px.
    expect(MAP_COVERED_WIDTH).toBe(1920);
    expect(width).toBeGreaterThanOrEqual(MAP_COVERED_WIDTH);
    const left = (window: number) => Math.max(-MAP_FRAME.wide[0], window - width);
    for (const window of [1024, 1280, 1440, 1600, 1760, MAP_COVERED_WIDTH]) {
      expect([window, left(window) <= 0 && left(window) + width >= window]).toEqual([window, true]);
    }
    expect(height - MAP_FRAME.wide[1]).toBeGreaterThanOrEqual(HERO_HEIGHT.wide);
    // Phone frame: up to the width where the hero stacks, over the map's height.
    expect(width - MAP_FRAME.phone[0]).toBeGreaterThanOrEqual(MAP_PHONE_MAX_WIDTH);
    expect(height - MAP_FRAME.phone[1]).toBeGreaterThanOrEqual(HERO_HEIGHT.phone);
    // The hero is the section's own full width, never inside the page's centred column.
    expect(css).toMatch(/\.hero\.mapview \{ height: /);
    expect(doc.querySelector('.wrap .hero')).toBeNull();
  });

  it('sets every word on the map, its plates and the "Example club" note at map text size or more', () => {
    expect(fontSize.mapLabelMin).toBeGreaterThanOrEqual(12);
    const sizesPx = [...mapCss().matchAll(/font-size: ([\d.]+)(rem|px)/g)].map(
      ([, n, unit]) => Number(n) * (unit === 'rem' ? ROOT_FONT_PX : 1),
    );
    expect(sizesPx.length).toBeGreaterThan(5);
    for (const px of sizesPx) expect(px).toBeGreaterThanOrEqual(fontSize.mapLabelMin);
    expect(css).toMatch(/\.map-note \{[^}]*font-size: /);
  });

  it('explains the map with the freshness-ring legend, drawn with the same markers', () => {
    const legend = doc.querySelector('dl.legend')!;
    const rows = [...legend.querySelectorAll(':scope > div')];
    // Valid HTML: the dl holds only divs, each exactly one dt then one dd. The symbol is inside
    // the dt and hidden from screen readers (a picture of the words beside it).
    expect([...legend.children].map((c) => c.tagName)).toEqual(rows.map(() => 'DIV'));
    for (const row of rows) {
      expect([...row.children].map((c) => c.tagName)).toEqual(['DT', 'DD']);
      const sym = row.querySelector('dt > .sym')!;
      expect(sym.getAttribute('aria-hidden')).toBe('true');
    }
    expect(legend.querySelectorAll('.sym')).toHaveLength(LEGEND.length);
    expect(rows.map((r) => r.querySelector('dt > .term')!.textContent)).toEqual(
      LEGEND.map((l) => l.title),
    );
    for (const freshness of ['fresh', 'stale', 'faded'] as const) {
      expect(legend.querySelector(`.mk.hunter.${RING_CLASS[freshness]}`)).not.toBeNull();
    }
    const text = textOf(legend.outerHTML);
    expect(text).toContain(`${FRESHNESS_THRESHOLDS_MS.fresh / MINUTE_MS} minutes`);
    expect(text).toContain(`${FRESHNESS_THRESHOLDS_MS.stale / MINUTE_MS} minutes`);
    expect(textOf(home)).toContain(HOME_PROMISE);
    expect(HOME_PROMISE).toMatch(/live, with no cell service/);
  });
});

describe('phone first', () => {
  const phoneRules = css.slice(css.indexOf(`@media ${PHONE_HEADER_MEDIA} {`));
  const ruleBody = (selector: string) => rules.find((r) => r.selector === selector)?.body ?? '';

  it('collapses the header to one 64 px row: the logo and one Menu button, never wrapping', () => {
    expect(PHONE_HEADER_HEIGHT).toBe(64);
    expect(phoneRules).toMatch(/\.site-nav, \.header-actions \{ display: none; \}/);
    expect(phoneRules).toContain(`.${MENU_TOGGLE_CLASS} { display: inline-flex; flex: none; }`);
    expect(phoneRules).toMatch(
      new RegExp(`\\.bar \\{ height: ${PHONE_HEADER_HEIGHT}px;[^}]*flex-wrap: nowrap;`),
    );
    // On wide screens neither the toggle nor the sheet shows.
    expect(ruleBody(`.${MENU_TOGGLE_CLASS}`)).toContain('display: none;');
    expect(css).toContain(
      `@media not ${PHONE_HEADER_MEDIA} {\n  #${MENU_SHEET_ID} { display: none; }`,
    );
  });

  it('opens the menu as a full-width sheet fixed under the header, locking the page under it', () => {
    const sheet = ruleBody(`#${MENU_SHEET_ID}`);
    expect(sheet).toContain('position: fixed;');
    expect(sheet).toContain(`top: ${PHONE_HEADER_HEIGHT}px; left: 0; right: 0;`);
    expect(sheet).toContain('background: var(--theme-plate);');
    expect(sheet).toContain('box-shadow: var(--theme-shadow-popover);');
    expect(phoneRules).toContain(
      `html.${MENU_OPEN_CLASS}, html.${MENU_OPEN_CLASS} body { overflow: hidden; }`,
    );
    // The header stays on screen, so the sheet always opens right under it.
    expect(phoneRules).toMatch(/\.site-header \{ position: sticky; top: 0;/);
  });

  it('gives every sized link and control the 48 px tap target', () => {
    expect(sizes.minTapTarget).toBe(48);
    const px = (value: string) =>
      value === 'var(--tap-min)' ? sizes.minTapTarget : Number(/^(\d+)px$/.exec(value)?.[1] ?? 0);
    for (const selector of SIZED_CONTROLS) {
      const rule = rules.find((r) => r.selector === selector);
      const height = px(/min-height: ([^;]+);/.exec(rule?.body ?? '')?.[1] ?? '');
      expect([selector, height]).toEqual([selector, expect.toSatisfy((h: number) => h >= 48)]);
    }
    // Any rule that changes a control's height keeps it at 48 or more.
    const controls = SIZED_CONTROLS.map((c) => c.split(' ').pop()!);
    for (const { selector, body } of rules) {
      const value = /min-height: ([^;]+);/.exec(body)?.[1];
      if (value && controls.some((c) => selector.includes(c))) {
        expect([selector, px(value)]).toEqual([selector, expect.toSatisfy((h: number) => h >= 48)]);
      }
    }
  });

  it('fits a 360 px phone: nothing fixed is wider than the screen less its gutters', () => {
    const room = NARROWEST_PHONE - 2 * GUTTER.phone;
    // The aerial is 2000 px by design, inside the clipped map window; the hero's plates have a
    // fixed width on wide screens only (checked below).
    const clipped = /^\.world|^\.hero \.(pitch|live)$/;
    for (const { selector, body } of rules) {
      if (clipped.test(selector)) continue;
      for (const m of body.matchAll(/(?:^|[;\s])(?:min-)?width: (\d+)px/g)) {
        expect([selector, Number(m[1])]).toEqual([
          selector,
          expect.toSatisfy((w: number) => w <= room),
        ]);
      }
    }
    const mapPhone = css.slice(css.indexOf(`@media (max-width: ${MAP_PHONE_MAX_WIDTH}px)`));
    expect(mapPhone).toMatch(/\.hero \.live \{[^}]*width: auto/);
    expect(mapPhone).toMatch(/\.hero \.pitch \{[^}]*width: auto/);
    // Every multi-column grid becomes one column on a phone.
    const narrow = css.slice(css.indexOf(`@media (max-width: ${NARROW_MAX_WIDTH}px)`));
    expect(narrow).toMatch(/\.two, \.split \{ grid-template-columns: 1fr;/);
    // Feature lists are one column until there is room for two.
    expect(ruleBody('.rows.cols')).toContain('grid-template-columns: 1fr;');
    expect(narrow).toMatch(/\.plan-heads \{ grid-template-columns: 1fr; \}/);
    expect(GUTTER.phone).toBe(16);
  });
});

describe('phone margins and type', () => {
  /** Classes that sit on the same element as `.wrap` on any page. */
  const besideWrap = [
    ...new Set(
      allPages.flatMap(({ html }) =>
        [...html.matchAll(/class="([^"]*\bwrap\b[^"]*)"/g)].flatMap((m) =>
          m[1]!.split(/\s+/).filter((c) => c && c !== 'wrap'),
        ),
      ),
    ),
  ];

  it('never lets a class beside .wrap reset its side gutters (only block padding)', () => {
    expect(besideWrap).toContain('page-head');
    for (const { selector, body } of rules) {
      if (!besideWrap.some((c) => selector === `.${c}`)) continue;
      expect([selector, body]).toEqual([
        selector,
        expect.not.stringMatching(/(^|[;\s])padding(-left|-right|-inline)?:/),
      ]);
    }
    expect(rules.find((r) => r.selector === '.page-head')?.body).toContain(
      'padding-block: 64px 36px;',
    );
  });

  it('never lets iOS inflate text, and steps the headline down on a phone either way up', () => {
    expect(css).toContain('-webkit-text-size-adjust: 100%; text-size-adjust: 100%;');
    expect(css).toContain(
      `@media ${PHONE_MEDIA} { h1 { font-size: ${rem(fontSize.displayPhone)}; line-height: 2.25rem; } }`,
    );
  });

  it('leaves out a hero label or plate at the widths where the window would cut it', () => {
    // Pond Box's plate, on the left of a marker just off an SE's screen, was cut at 375 px.
    const pond = SAMPLE_CLUB.stands.findIndex((s) => s.name === 'Pond Box');
    const hides = [
      ...css.matchAll(
        new RegExp(
          `@media \\(min-width: (\\d+)px\\) and \\(max-width: (\\d+)px\\) \\{ \\.hero \\.${AT.stand(pond)} \\{ display: none; \\} \\}`,
          'g',
        ),
      ),
    ].map((m) => [Number(m[1]), Number(m[2])] as const);
    expect(hides.some(([from, to]) => from <= 375 && 375 <= to)).toBe(true);
  });
});

describe('wide screens', () => {
  it('centres the content in a 1120 px column, outside the gutters', () => {
    expect(CONTENT_MAX_WIDTH).toBe(1120);
    expect(css).toContain(
      `.wrap { max-width: ${CONTENT_MAX_WIDTH + 2 * GUTTER.wide}px; margin: 0 auto; padding: 0 ${GUTTER.wide}px; }`,
    );
  });

  it('sets feature lists in two columns from the desktop width', () => {
    expect(FEATURE_COLUMNS_MIN_WIDTH).toBe(breakpoints.desktop);
    const wide = css.slice(css.indexOf(`@media (min-width: ${FEATURE_COLUMNS_MIN_WIDTH}px) {`));
    expect(wide).toMatch(/^[^}]*\.rows\.cols \{ grid-template-columns: 1fr 1fr;/);
  });
});

describe('theme colours', () => {
  /** The theme colour a declaration names: `var(--theme-text)` → `text`. */
  const tokenOf = (body: string, property: string) =>
    new RegExp(`(?:^|[;{\\s])${property}: [^;]*?var\\(--theme-([a-z-]+)\\)`).exec(body)?.[1];
  /** Where text with no background of its own can land: the page, a plate or a raised row. */
  const GROUNDS = ['canvas', 'plate', 'raised'] as const;
  /** Colours drawn on one ground only (docs/DESIGN.md): fresh text on a plate, text on orange. */
  const ONLY_ON: Record<string, string> = { fresh: 'plate', 'on-accent': 'accent' };
  const EDGES = ['border', 'border-color', 'outline', 'border-left', 'border-top', 'border-bottom'];

  /** Body and second-line text as CSS names (`textSecondary` → `text-secondary`). */
  const DAYLIGHT_BODY = new Set<string>(
    DAYLIGHT_BODY_TOKENS.map((t) => t.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)),
  );

  it.each(Object.keys(themes) as (keyof typeof themes)[])(
    'holds every pair the %s theme draws to 4.5:1 for text (7:1 for daylight body) and 3:1 for edges',
    (name) => {
      const vars = themeVariables(themes[name]);
      const hex = (token: string) => vars[`--theme-${token}`]!;
      const minText = (token: string) =>
        name === 'light' && DAYLIGHT_BODY.has(token)
          ? MIN_DAYLIGHT_BODY_CONTRAST
          : MIN_TEXT_CONTRAST;
      let checked = 0;
      for (const { selector, body } of rules) {
        const ground = tokenOf(body, 'background');
        const text = tokenOf(body, 'color');
        if (text) {
          for (const g of ground ? [ground] : ONLY_ON[text] ? [ONLY_ON[text]] : GROUNDS) {
            checked++;
            expect([selector, text, g, contrastRatio(hex(text), hex(g))]).toEqual([
              selector,
              text,
              g,
              expect.toSatisfy((r: number) => r >= minText(text)),
            ]);
          }
        }
        for (const edge of EDGES) {
          const color = tokenOf(body, edge);
          // Hairlines divide rows; nothing depends on seeing them (docs/DESIGN.md).
          if (!color || color === 'border-subtle') continue;
          // An edge shows against what is around the control, not its own fill.
          for (const g of GROUNDS) {
            checked++;
            expect([selector, color, g, contrastRatio(hex(color), hex(g))]).toEqual([
              selector,
              color,
              g,
              expect.toSatisfy((r: number) => r >= MIN_UI_CONTRAST),
            ]);
          }
        }
      }
      expect(checked).toBeGreaterThan(40);
    },
  );

  it('follows the device: dark by default, daylight when it prefers light', () => {
    expect(css).toContain(':root, [data-theme="dark"] {');
    expect(css).toContain('@media (prefers-color-scheme: light)');
    expect(css).toMatch(/html, body \{[^}]*background: var\(--theme-canvas\)/);
  });

  it('uses only tokens: no hex colours outside the generated variables, no old light bands', () => {
    const own = css.slice(css.indexOf('* {'));
    expect(own).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(own).not.toMatch(/rgba?\(/);
    expect(own).not.toMatch(/band-light|--color-(surface|bg-light|text-on-light|muted|link)/);
    // The map's own colours are the only --color-* the site uses, and each exists.
    const vars = tokenVariables();
    for (const [, name] of own.matchAll(/var\((--color-[a-z-]+)\)/g)) {
      expect([name, vars[name!]]).toEqual([name, expect.any(String)]);
    }
  });
});
