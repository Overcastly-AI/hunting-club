import { cognitoEndpoint } from '@huntclub/shared';
import { dev } from '../config/dev';
import { cloudFor } from '../src/cloud';
import {
  contentSecurityPolicy,
  PERMISSIONS_POLICY,
  REFERRER_POLICY,
} from '../src/security-headers';

const directives = (csp: string) =>
  Object.fromEntries(
    csp.split('; ').map((d) => {
      const [name, ...sources] = d.split(' ');
      return [name!, sources];
    }),
  );

describe('Content-Security-Policy', () => {
  const csp = directives(contentSecurityPolicy(dev));

  it('allows only this origin, plus Cognito and the club API for the admin', () => {
    const cloud = cloudFor(dev);
    expect(csp['default-src']).toEqual(["'self'"]);
    expect(csp['connect-src']).toEqual([
      "'self'",
      new URL(cognitoEndpoint(cloud.region)).origin,
      new URL(cloud.clubApiUrl!).origin,
    ]);
    expect(csp['img-src']).toEqual(["'self'", 'data:']);
    expect(csp['font-src']).toEqual(["'self'"]);
  });

  it('allows no inline scripts or styles at all: only files from this origin', () => {
    expect(csp['script-src']).toEqual(["'self'"]);
    expect(csp['style-src']).toEqual(["'self'"]);
    expect(contentSecurityPolicy(dev)).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
  });

  it('blocks framing, plugins, other base URLs and other form targets', () => {
    expect(csp['frame-ancestors']).toEqual(["'none'"]);
    expect(csp['object-src']).toEqual(["'none'"]);
    expect(csp['base-uri']).toEqual(["'self'"]);
    expect(csp['form-action']).toEqual(["'self'"]);
  });

  it('fits a CloudFront response headers policy (1783 characters at most)', () => {
    expect(contentSecurityPolicy(dev).length).toBeLessThanOrEqual(1783);
  });
});

describe('other policies', () => {
  it('turn off the camera, microphone and location, and send no referrer from /join', () => {
    expect(PERMISSIONS_POLICY.value).toBe('camera=(), geolocation=(), microphone=()');
    expect(REFERRER_POLICY).toEqual({
      site: 'strict-origin-when-cross-origin',
      join: 'no-referrer',
    });
  });
});
