// The route registry: the one list of public pages. Navigation, the footer, canonical
// URLs, Open Graph meta and the prerender list come from here (and, later, sitemap.xml
// and the CloudFront allowlist). Add a page here and it is built, linked and tested.
import { LEGAL_PATHS, WEB_DOMAINS } from '@huntclub/shared/app';

/** Where the site is served. Dev only so far; a production domain is added here. */
export const SITE_ORIGIN = `https://${WEB_DOMAINS.dev}`;

/** The club admin (the web app), linked as "Sign in". */
export const ADMIN_PATH = '/app/';

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

/** Where a page is written in dist: `/` → index.html, `/clubs` → clubs/index.html. */
export const outputFile = (path: string) =>
  path === '/' ? 'index.html' : `${path.slice(1)}/index.html`;
