// App identity shared by the Expo app config, the web admin page and infra
// (universal-link files). The single source: never retype these elsewhere.

/** The product name, as people see it (app name, page titles, sign-in). */
export const APP_NAME = 'Hunt Club Mesh';

/** One line about the product, for the web page's meta description and sign-in. */
export const APP_DESCRIPTION =
  'Off-grid hunting with your party and club over Meshtastic radios. Club admins manage members, stands and map packs here.';

/** iOS bundle identifier and Android package name. */
export const APP_ID = 'com.overcastly.huntclub';

/** Custom URL scheme (`huntclub://…`), used by the in-app scanner and as a fallback. */
export const URL_SCHEME = 'huntclub';

/**
 * Web domain per environment: the admin page (S3 + CloudFront) and the host of the
 * https join links / universal links. Infra, mesh and web read it from here.
 */
export const WEB_DOMAINS = {
  dev: 'huntclub-dev.jaycobjones.com',
} as const;

/**
 * Where the club admin (the web app) is served: its Vite base and the public site's
 * "Sign in" link. Its pages are hash routes under it, e.g. /app/#/roster.
 */
export const ADMIN_PATH = '/app/';

/**
 * The admin build's id file (web/build-version.ts writes it), served no-cache next to
 * its index.html so an open tab can tell a newer build is live.
 */
export const BUILD_VERSION_FILE = 'version.json';
export const BUILD_VERSION_URL = `${ADMIN_PATH}${BUILD_VERSION_FILE}`;

/** Privacy and Terms pages (copy in ./legal), linked from the web sign-in footer. */
export const LEGAL_PATHS = { privacy: '/privacy', terms: '/terms' } as const;

/** Path of the join page that club and party invite links open. */
export const JOIN_PATH = '/join';

/**
 * https paths the app claims as universal links (iOS) / app links (Android).
 * Club invite QR codes use `https://<web domain>/join…` so a camera scan works
 * even before the app is installed (docs/research/stripe-and-auth.md §9).
 */
export const APP_LINK_PATHS = [JOIN_PATH] as const;

/** Web admin pages Stripe Checkout returns to (on the web domain). */
export const CHECKOUT_RETURN_PATHS = {
  success: '/checkout/done',
  cancel: '/checkout/cancel',
} as const;

/**
 * Real (non-hash) paths the club admin (web/) answers on its own domain, with no sign-in:
 * the Checkout return pages. CloudFront serves the admin's index.html for each; the
 * admin's own pages use hash routes under ADMIN_PATH. /join, Privacy and Terms are static
 * pages of the public site.
 */
export const WEB_PAGE_PATHS = Object.values(CHECKOUT_RETURN_PATHS);

/**
 * Support email, shown on the site's Contact page. OPEN DECISION (owner): no address yet,
 * so the page says one is coming; set it here and every page that shows it follows.
 */
export const SUPPORT_EMAIL: string | undefined = undefined;
