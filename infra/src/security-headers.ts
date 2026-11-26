// The web's security headers: the one source for the CloudFront response headers policy
// (stacks/web-stack.ts) and the smoke check. The public site and the club admin share one
// origin and one policy; /join differs only in sending no referrer.
import { createHash } from 'node:crypto';
import { HeadersReferrerPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { cognitoEndpoint } from '@huntclub/shared';
import { HASH_FORWARD_SCRIPT } from '@huntclub/site/routes';
import type { EnvConfig } from '../config';
import { cloudFor } from './cloud';

/** CSP source for an inline script, by its SHA-256. */
const scriptHash = (source: string) =>
  `'sha256-${createHash('sha256').update(source).digest('base64')}'`;

/**
 * Content-Security-Policy. Everything is self-hosted: scripts and styles are files (no
 * inline styles at all), except the home page's one inline script, allowed by its hash.
 * The admin calls Cognito (sign-in) and the club API, nothing else. Stripe Checkout is a
 * full-page navigation, which the CSP does not restrict. No page may be framed.
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
    'script-src': ["'self'", scriptHash(HASH_FORWARD_SCRIPT)],
    'style-src': ["'self'"],
    'img-src': ["'self'", 'data:'],
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
 * Permissions-Policy: nothing on the web uses the camera, microphone or location (QR codes
 * are scanned by phone camera apps or the mobile app, never in the browser).
 */
export const PERMISSIONS_POLICY = {
  header: 'Permissions-Policy',
  value: 'camera=(), geolocation=(), microphone=()',
} as const;

/** Referrer-Policy: the whole site, and /join (its URL holds an invite). */
export const REFERRER_POLICY = {
  site: HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
  join: HeadersReferrerPolicy.NO_REFERRER,
} as const;
