// The route registry: the one list of public pages. Navigation, the footer, canonical
// URLs, Open Graph meta, the prerender list, sitemap.xml, robots.txt rules and the
// CloudFront allowlist and redirects (infra/src/web-pages.ts) all come from here. Add a
// page here and it is built, linked, served and tested.
import {
  ADMIN_PATH,
  CHECKOUT_RETURN_PATHS,
  JOIN_PATH,
  LEGAL_PATHS,
  WEB_DOMAINS,
  WEB_PAGE_PATHS,
} from '@huntclub/shared/app';

/** Where the site is served. Dev only so far; a production domain is added here. */
export const SITE_ORIGIN = `https://${WEB_DOMAINS.dev}`;

export interface SiteRoute {
  /** Absolute path, no trailing slash except the home page. */
  readonly path: string;
  /** `<title>`: at most 60 characters. */
  readonly title: string;
  /** Meta and Open Graph description: 70 to 160 characters. */
  readonly description: string;
}

export const ROUTES = [
  {
    path: '/',
    title: 'Hunt Club Mesh: hunting party map and chat, no cell service',
    description:
      'A live map, chat and check-in for your hunting party over Meshtastic radios, with no cell service. Free for parties of up to 3; clubs subscribe.',
  },
] as const satisfies readonly SiteRoute[];

export type SitePath = (typeof ROUTES)[number]['path'];

/** Sections of the home page that the navigation links to (ids on the page). */
export const HOME_SECTIONS = {
  features: 'features',
  forClubs: 'for-clubs',
  getTheApp: 'get-the-app',
  faq: 'faq',
} as const;

const homeSection = (id: string) => `/#${id}`;

export interface SiteLink {
  readonly label: string;
  readonly href: string;
}

/** Header navigation, in order. Pages added to ROUTES later take over the section links. */
export const NAV_LINKS: readonly SiteLink[] = [
  { label: 'Features', href: homeSection(HOME_SECTIONS.features) },
  { label: 'For clubs', href: homeSection(HOME_SECTIONS.forClubs) },
  { label: 'FAQ', href: homeSection(HOME_SECTIONS.faq) },
];

/** The header's main action. */
export const GET_THE_APP: SiteLink = {
  label: 'Get the free app',
  href: homeSection(HOME_SECTIONS.getTheApp),
};

export const SIGN_IN: SiteLink = { label: 'Sign in', href: ADMIN_PATH };

/** Footer links (Privacy and Terms are served by the club admin until they move here). */
export const FOOTER_LINKS: readonly SiteLink[] = [
  { label: 'Privacy', href: LEGAL_PATHS.privacy },
  { label: 'Terms', href: LEGAL_PATHS.terms },
];

/** The canonical URL of a registered page. */
export const canonicalUrl = (path: string) => `${SITE_ORIGIN}${path}`;

/**
 * The branded not-found page. CloudFront serves it for any missing path with a 404
 * status; it is never indexed and has no canonical URL.
 */
export const NOT_FOUND_PAGE = {
  file: '404.html',
  title: 'Page not found · Hunt Club Mesh',
  description:
    'This page does not exist. Go to the Hunt Club Mesh home page, or sign in to the club admin.',
} as const;

/**
 * Real paths the club admin (web/, under ADMIN_PATH) still answers: /join, the Checkout
 * return pages, Privacy and Terms. CloudFront sends them to the admin's index.html.
 */
export const ADMIN_PAGE_PATHS: readonly string[] = WEB_PAGE_PATHS;

/** Permanent redirects (301): old and guessable addresses. */
export const REDIRECTS: Readonly<Record<string, string>> = {
  '/index.html': '/',
  '/login': ADMIN_PATH,
  '/sign-in': ADMIN_PATH,
};

/** Never search results: the admin, invites and the Checkout return pages (robots.txt). */
export const NOINDEX_PATHS: readonly string[] = [
  ADMIN_PATH,
  JOIN_PATH,
  ...Object.values(CHECKOUT_RETURN_PATHS),
];

/** sitemap.xml: every registered page (all indexable), with the build date. */
export function sitemapXml(lastmod: string): string {
  const urls = ROUTES.map(
    (r) => `  <url><loc>${canonicalUrl(r.path)}</loc><lastmod>${lastmod}</lastmod></url>`,
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

export const SITEMAP_FILE = 'sitemap.xml';

/**
 * The one script the site ships, inlined on the home page only: an old admin bookmark
 * (/#/roster, from when the admin lived at /) goes on to the admin (/app/#/roster).
 */
export const HASH_FORWARD_SCRIPT = `if(location.hash.indexOf('#/')===0)location.replace('${ADMIN_PATH}'+location.hash)`;

/** Where a page is written in dist: `/` → index.html, `/clubs` → clubs/index.html. */
export const outputFile = (path: string) =>
  path === '/' ? 'index.html' : `${path.slice(1)}/index.html`;
