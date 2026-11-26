// Sign-in with an emailed one-time code (Cognito USER_AUTH + EMAIL_OTP), over Cognito's
// JSON API with an injected fetch. No AWS SDK: these calls are unsigned (public app
// client, no secret), and React Native would need polyfills for the SDK. Shared by the
// app and the web admin (docs/research/stripe-and-auth.md: email + emailed code; the
// code length depends on the challenge, see emailCodeRules).
import { type FetchLike, readJson } from './http';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** When the access token expires (ms since epoch). */
  expiresAt: number;
}

/** Waiting for the code we just emailed. New users are signed up first. */
export type CodeChallenge =
  { kind: 'signIn'; email: string; session: string } | { kind: 'signUp'; email: string };

export type CognitoAuthErrorCode =
  'wrong_code' | 'code_expired' | 'too_many_attempts' | 'invalid_email' | 'network' | 'unknown';

/** Maps Cognito exception names to what the sign-in screen tells the user. */
const ERROR_CODES: Record<string, CognitoAuthErrorCode> = {
  CodeMismatchException: 'wrong_code',
  ExpiredCodeException: 'code_expired',
  NotAuthorizedException: 'code_expired',
  TooManyRequestsException: 'too_many_attempts',
  LimitExceededException: 'too_many_attempts',
  TooManyFailedAttemptsException: 'too_many_attempts',
  InvalidParameterException: 'invalid_email',
};

export class CognitoAuthError extends Error {
  constructor(
    readonly code: CognitoAuthErrorCode,
    readonly awsType?: string,
  ) {
    super(code);
    this.name = 'CognitoAuthError';
  }
}

interface AuthenticationResult {
  AccessToken: string;
  RefreshToken?: string;
  ExpiresIn: number;
}

export interface CognitoAuthOptions {
  region: string;
  clientId: string;
  fetch: FetchLike;
  now?: () => number;
}

export function createCognitoAuth(options: CognitoAuthOptions) {
  const now = options.now ?? Date.now;
  const endpoint = `https://cognito-idp.${options.region}.amazonaws.com/`;

  async function call<T>(action: string, body: Record<string, unknown>): Promise<T> {
    let res;
    try {
      res = await options.fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-amz-json-1.1',
          'x-amz-target': `AWSCognitoIdentityProviderService.${action}`,
        },
        body: JSON.stringify({ ClientId: options.clientId, ...body }),
      });
    } catch {
      throw new CognitoAuthError('network');
    }
    const json = (await readJson(res).catch(() => undefined)) as
      Record<string, unknown> | undefined;
    if (res.status >= 400) {
      const type =
        String(json?.__type ?? '')
          .split('#')
          .pop() ?? '';
      throw new CognitoAuthError(ERROR_CODES[type] ?? 'unknown', type);
    }
    return json as T;
  }

  const tokens = (r: AuthenticationResult | undefined, refreshToken?: string): AuthTokens => {
    const refresh = r?.RefreshToken ?? refreshToken;
    if (!r?.AccessToken || !refresh) throw new CognitoAuthError('unknown', 'NoTokens');
    return {
      accessToken: r.AccessToken,
      refreshToken: refresh,
      expiresAt: now() + r.ExpiresIn * 1000,
    };
  };

  type InitiateResponse = {
    ChallengeName?: string;
    Session?: string;
    AuthenticationResult?: AuthenticationResult;
  };

  return {
    /**
     * Emails a one-time code. Tries SignUp first: the pools hide whether a user exists
     * (PreventUserExistenceErrors), so InitiateAuth answers an unknown email with a normal
     * looking challenge and sends nothing, but SignUp still says UsernameExistsException.
     * - New email: SignUp emails the confirmation code.
     * - Existing confirmed user: InitiateAuth USER_AUTH with EMAIL_OTP.
     * - Existing user who never confirmed: the confirmation code is sent again.
     */
    async requestCode(email: string): Promise<CodeChallenge> {
      try {
        await call('SignUp', {
          Username: email,
          UserAttributes: [{ Name: 'email', Value: email }],
        });
        return { kind: 'signUp', email };
      } catch (error) {
        if (!(error instanceof CognitoAuthError) || error.awsType !== 'UsernameExistsException')
          throw error;
      }
      try {
        const out = await call<InitiateResponse>('InitiateAuth', {
          AuthFlow: 'USER_AUTH',
          AuthParameters: { USERNAME: email, PREFERRED_CHALLENGE: 'EMAIL_OTP' },
        });
        if (out.ChallengeName !== 'EMAIL_OTP' || !out.Session) {
          throw new CognitoAuthError('unknown', out.ChallengeName);
        }
        return { kind: 'signIn', email, session: out.Session };
      } catch (error) {
        if (!(error instanceof CognitoAuthError) || error.awsType !== 'UserNotConfirmedException')
          throw error;
        await call('ResendConfirmationCode', { Username: email });
        return { kind: 'signUp', email };
      }
    },

    /** Exchanges the emailed code for tokens. */
    async confirmCode(challenge: CodeChallenge, code: string): Promise<AuthTokens> {
      if (challenge.kind === 'signIn') {
        const out = await call<{ AuthenticationResult?: AuthenticationResult }>(
          'RespondToAuthChallenge',
          {
            ChallengeName: 'EMAIL_OTP',
            Session: challenge.session,
            ChallengeResponses: { USERNAME: challenge.email, EMAIL_OTP_CODE: code },
          },
        );
        return tokens(out.AuthenticationResult);
      }
      // A new user confirms with the sign-up code, then signs in with that session.
      const confirmed = await call<{ Session?: string }>('ConfirmSignUp', {
        Username: challenge.email,
        ConfirmationCode: code,
      });
      const out = await call<InitiateResponse>('InitiateAuth', {
        AuthFlow: 'USER_AUTH',
        AuthParameters: { USERNAME: challenge.email },
        Session: confirmed.Session,
      });
      return tokens(out.AuthenticationResult);
    },

    /** New access token from the refresh token (which stays the same). */
    async refresh(refreshToken: string): Promise<AuthTokens> {
      const out = await call<InitiateResponse>('InitiateAuth', {
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        AuthParameters: { REFRESH_TOKEN: refreshToken },
      });
      return tokens(out.AuthenticationResult, refreshToken);
    },

    /** Revokes the refresh token (signing out on this device). */
    async revoke(refreshToken: string): Promise<void> {
      await call('RevokeToken', { Token: refreshToken });
    },
  };
}

export type CognitoAuth = ReturnType<typeof createCognitoAuth>;
