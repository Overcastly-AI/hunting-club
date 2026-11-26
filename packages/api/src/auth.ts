import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type { Jwks } from 'aws-jwt-verify/jwk';

/** Turns a bearer token into the caller's Cognito `sub`, or throws. */
export interface TokenVerifier {
  verify(token: string): Promise<string>;
}

export interface CognitoConfig {
  userPoolId: string;
  /** App and web client ids allowed to call the API. */
  clientIds: readonly string[];
}

/**
 * Verifies Cognito ACCESS tokens: signature (pool JWKS), issuer = the pool, client id
 * in `clientIds`, token_use = access, expiry. `jwks` preloads the keys (tests; no
 * network); otherwise they are fetched once per container and cached.
 */
export function cognitoVerifier(config: CognitoConfig, jwks?: Jwks): TokenVerifier {
  const verifier = CognitoJwtVerifier.create({
    userPoolId: config.userPoolId,
    tokenUse: 'access',
    clientId: [...config.clientIds],
  });
  if (jwks) verifier.cacheJwks(jwks);
  return { verify: async (token) => (await verifier.verify(token)).sub };
}
