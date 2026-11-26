/**
 * A local stand-in for a Cognito user pool: an RSA key pair, its JWKS, and a signer
 * for access tokens. Tests preload the JWKS into the verifier, so nothing touches
 * the network.
 */
import { createSign, generateKeyPairSync, randomUUID } from 'node:crypto';
import type { Jwks } from 'aws-jwt-verify/jwk';
import type { CognitoConfig } from '../auth';

export const TEST_POOL: CognitoConfig = {
  userPoolId: 'us-east-1_TestPool1',
  clientIds: ['testappclient', 'testwebclient'],
};

const b64url = (data: string | Buffer) => Buffer.from(data).toString('base64url');

export class TestUserPool {
  private readonly kid = randomUUID();
  private readonly keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  readonly issuer = `https://cognito-idp.us-east-1.amazonaws.com/${TEST_POOL.userPoolId}`;

  get jwks(): Jwks {
    const { n, e } = this.keys.publicKey.export({ format: 'jwk' });
    return { keys: [{ kty: 'RSA', n: n!, e: e!, kid: this.kid, alg: 'RS256', use: 'sig' }] };
  }

  /** A signed access token for `sub`; `claims` overrides any field (for negative tests). */
  accessToken(sub: string, claims: Record<string, unknown> = {}): string {
    const now = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: 'RS256', kid: this.kid, typ: 'JWT' }));
    const payload = b64url(
      JSON.stringify({
        sub,
        iss: this.issuer,
        client_id: TEST_POOL.clientIds[0],
        token_use: 'access',
        scope: 'aws.cognito.signin.user.admin',
        iat: now,
        exp: now + 3600,
        jti: randomUUID(),
        ...claims,
      }),
    );
    const signature = createSign('RSA-SHA256')
      .update(`${header}.${payload}`)
      .sign(this.keys.privateKey);
    return `${header}.${payload}.${b64url(signature)}`;
  }

  /** A token signed by a different key (same claims): must be rejected. */
  forgedToken(sub: string): string {
    return new TestUserPool().accessToken(sub);
  }
}
