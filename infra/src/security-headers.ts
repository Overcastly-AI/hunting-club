// The web's security headers: the one source for the CloudFront response headers policy
// (stacks/web-stack.ts) and the smoke check. The public site and the club admin share one
// origin and one policy; /join differs only in sending no referrer.
import { HeadersReferrerPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { cognitoEndpoint, USGS_BASEMAP_ORIGIN } from '@huntclub/shared';
import type { EnvConfig } from '../config';
import { cloudFor } from './cloud';

/**
 * Content-Security-Policy. Everything is self-hosted: scripts and styles are files, with no
 * inline scripts or styles at all (the site tests and the smoke check hold pages to it with
 * cspViolations from @huntclub/site/csp).
 * The admin calls Cognito (sign-in) and the club API, nothing else. Its map shows live USGS
 * basemap tiles as plain images, so img-src allows exactly that one origin (from the shared
 * BASEMAPS root) and connect-src does not. Stripe Checkout is a full-page navigation, which the
 * CSP does not restrict. No page may be framed.
 */
export function contentSecurityPolicy(config: Pick<EnvConfig, 'name'>): string {
  const cloud = cloudFor(config);
  const connect = [
    "'self'",
    new URL(cognitoEndpoint(cloud.region)).origin,
    ...(cloud.clubApiUrl ? [new URL(cloud.clubApiUrl).origin] : []),
  ];
  const directives: Record<string, readonly string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'"],
    'img-src': ["'self'", 'data:', USGS_BASEMAP_ORIGIN],
    'font-src': ["'self'"],
    'connect-src': connect,
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ');
}

/**
 * Permissions-Policy: nothing on the web uses the camera or microphone (QR codes are scanned by
 * phone camera apps or the mobile app, never in the browser). Location is this origin only: the
 * admin map's "Use my location" centres the map on the admin, in the browser; it is never sent.
 */
export const PERMISSIONS_POLICY = {
  header: 'Permissions-Policy',
  value: 'camera=(), geolocation=(self), microphone=()',
} as const;

/** Referrer-Policy: the whole site, and /join (its URL holds an invite). */
export const REFERRER_POLICY = {
  site: HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
  join: HeadersReferrerPolicy.NO_REFERRER,
} as const;
