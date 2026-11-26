// JSON-LD for search engines (schema.org): only facts the product can back. No ratings
// or reviews until real ones exist, and no download URL until the store listings do.
import { APP_NAME } from '@huntclub/shared';
import { PAGE_PATHS, ROUTES, SITE_LOGO, SITE_ORIGIN } from './routes';

const CONTEXT = 'https://schema.org';

export const ORGANIZATION = {
  '@context': CONTEXT,
  '@type': 'Organization',
  name: APP_NAME,
  url: SITE_ORIGIN,
  logo: `${SITE_ORIGIN}/${SITE_LOGO.file}`,
} as const;

export const WEBSITE = {
  '@context': CONTEXT,
  '@type': 'WebSite',
  name: APP_NAME,
  url: SITE_ORIGIN,
} as const;

export const SOFTWARE_APPLICATION = {
  '@context': CONTEXT,
  '@type': 'SoftwareApplication',
  name: APP_NAME,
  // The home page's description: what the app does, for hunters.
  description: ROUTES.find((r) => r.path === PAGE_PATHS.home)!.description,
  operatingSystem: 'iOS, Android',
  applicationCategory: 'SportsApplication',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
} as const;

/** The structured data each page carries (none on the others). */
export const STRUCTURED_DATA: Readonly<Record<string, readonly object[]>> = {
  [PAGE_PATHS.home]: [ORGANIZATION, WEBSITE, SOFTWARE_APPLICATION],
  [PAGE_PATHS.download]: [SOFTWARE_APPLICATION],
};

/** JSON for an inline `<script type="application/ld+json">`: `<` escaped so it cannot end the script. */
export const jsonLd = (data: object) => JSON.stringify(data).replace(/</g, '\\u003c');
