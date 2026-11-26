// The route registry: the one list of public pages. Navigation, the footer, canonical
// URLs, Open Graph meta, the prerender list, sitemap.xml, robots.txt rules and the
// CloudFront allowlist and redirects (infra/src/web-pages.ts) all come from here. Add a
// page here and it is built, linked, served and tested.
import { CLUB_PRICING, FREE_PARTY_MAX_MEMBERS, LEGAL_DOCS } from '@huntclub/shared';
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

const { intervals, trialDays } = CLUB_PRICING;
/** "$100/year or $10/month", from the one pricing source. */
export const CLUB_PRICE_LINE = `${intervals.year.price} or ${intervals.month.price}`;

/** Paths of the pages, for links. Each is registered in ROUTES below. */
export const PAGE_PATHS = {
  home: '/',
  clubs: '/clubs',
  pricing: '/pricing',
  download: '/download',
  contact: '/contact',
  privacy: LEGAL_PATHS.privacy,
  terms: LEGAL_PATHS.terms,
} as const;

export const ROUTES = [
  {
    path: PAGE_PATHS.home,
    title: 'Hunt Club Mesh: hunting party map and chat, no cell service',
    description: `A live map, chat and check-in for your hunting party over Meshtastic radios, with no cell service. Free for parties of up to ${FREE_PARTY_MAX_MEMBERS}; clubs subscribe.`,
  },
  {
    path: PAGE_PATHS.clubs,
    title: 'Hunting club app: stands, roster, board | Hunt Club Mesh',
    description:
      'Run your hunting club or lease from one app: who is in which stand, who is overdue, the roster and a clubhouse board. Works with no cell service.',
  },
  {
    path: PAGE_PATHS.pricing,
    title: 'Pricing: free app, one plan for clubs | Hunt Club Mesh',
    description: `The app is free for hunters and parties of up to ${FREE_PARTY_MAX_MEMBERS}. Clubs pay ${CLUB_PRICE_LINE}, with a ${trialDays}-day free trial.`,
  },
  {
    path: PAGE_PATHS.download,
    title: 'Get Hunt Club Mesh for iPhone and Android',
    description:
      'Hunt Club Mesh is being tested on iPhone and Android before it goes into the stores. See what you need: a phone and a Meshtastic radio with GPS.',
  },
  {
    path: PAGE_PATHS.contact,
    title: 'Contact | Hunt Club Mesh',
    description:
      'How to reach the Hunt Club Mesh team with questions about the app, Meshtastic radios, or club plans and billing.',
  },
  {
    path: PAGE_PATHS.privacy,
    title: `${LEGAL_DOCS.privacy.title} | Hunt Club Mesh`,
    description:
      'What Hunt Club Mesh does with your information: free hunters have no account, and your location is shared only while you are checked in.',
  },
  {
    path: PAGE_PATHS.terms,
    title: `${LEGAL_DOCS.terms.title} | Hunt Club Mesh`,
    description:
      'The terms for using Hunt Club Mesh: not an emergency service, free for hunting parties, and what a club subscription covers.',
  },
] as const satisfies readonly SiteRoute[];

export type SitePath = (typeof ROUTES)[number]['path'];

/** Sections of the home page that the navigation links to (ids on the page). */
export const HOME_SECTIONS = {
  features: 'features',
  forClubs: 'for-clubs',
  faq: 'faq',
} as const;

const homeSection = (id: string) => `/#${id}`;

export interface SiteLink {
  readonly label: string;
  readonly href: string;
}

/** Header navigation, in order. */
export const NAV_LINKS: readonly SiteLink[] = [
  { label: 'Features', href: homeSection(HOME_SECTIONS.features) },
  { label: 'For clubs', href: PAGE_PATHS.clubs },
  { label: 'Pricing', href: PAGE_PATHS.pricing },
  { label: 'FAQ', href: homeSection(HOME_SECTIONS.faq) },
];

/** The header's main action. */
export const GET_THE_APP: SiteLink = { label: 'Get the free app', href: PAGE_PATHS.download };

export const SIGN_IN: SiteLink = { label: 'Sign in', href: ADMIN_PATH };

/** A club admin's start: sign in to the club admin, then create the club. */
export const START_A_CLUB: SiteLink = { label: CLUB_PRICING.cta, href: ADMIN_PATH };

/** Footer link groups, each with a heading. */
export const FOOTER_GROUPS: readonly { heading: string; links: readonly SiteLink[] }[] = [
  {
    heading: 'Product',
    links: [
      { label: 'Pricing', href: PAGE_PATHS.pricing },
      { label: 'Download', href: PAGE_PATHS.download },
    ],
  },
  {
    heading: 'Clubs',
    links: [{ label: 'For clubs', href: PAGE_PATHS.clubs }, SIGN_IN],
  },
  { heading: 'Company', links: [{ label: 'Contact', href: PAGE_PATHS.contact }] },
  {
    heading: 'Legal',
    links: [
      { label: LEGAL_DOCS.privacy.title, href: PAGE_PATHS.privacy },
      { label: LEGAL_DOCS.terms.title, href: PAGE_PATHS.terms },
    ],
  },
];

/** Every footer link. */
export const FOOTER_LINKS: readonly SiteLink[] = FOOTER_GROUPS.flatMap((g) => g.links);

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
 * Real paths the club admin (web/, under ADMIN_PATH) still answers: the Checkout return
 * pages. CloudFront sends them to the admin's index.html.
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

/**
 * The invite landing page (/join): never indexed, no canonical URL, sent with no
 * referrer. The invite (with the radio channel key) is in the URL fragment, which never
 * reaches the server: the page's one self-hosted script reads it in the browser and
 * never sends or logs it. No third-party scripts, fonts or images.
 */
export const JOIN_PAGE = {
  path: JOIN_PATH,
  file: outputFile(JOIN_PATH),
  title: 'Your invite · Hunt Club Mesh',
  description:
    'Open your Hunt Club Mesh invite on your phone to join a hunting party or club. The app sets up your radio and works with no cell service.',
} as const;
