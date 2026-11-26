// App identity shared by the Expo app config, the web admin page and infra
// (universal-link files). The single source: never retype these elsewhere.

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
