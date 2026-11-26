import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { AuthError, type AuthClient, type CodeChallenge, type SignedIn } from './types';

/** Maps Cognito exception names to the page's error codes. Tokens are never logged. */
function toAuthError(error: unknown): AuthError {
  const name = (error as { name?: string } | null)?.name ?? '';
  if (name === 'UserNotFoundException' || name === 'NotAuthorizedException') {
    return new AuthError('unknown_user');
  }
  if (name === 'CodeMismatchException' || name === 'ExpiredCodeException') {
    return new AuthError('wrong_code');
  }
  if (name === 'TooManyRequestsException' || name === 'LimitExceededException') {
    return new AuthError('too_many_attempts');
  }
  return new AuthError('unavailable');
}

/** Cognito choice-based sign-in: InitiateAuth(USER_AUTH, EMAIL_OTP) then the code. */
export function cognitoAuthClient(opts: { region: string; clientId: string }): AuthClient {
  const client = new CognitoIdentityProviderClient({ region: opts.region });

  return {
    live: true,
    async requestCode(email): Promise<CodeChallenge> {
      try {
        const res = await client.send(
          new InitiateAuthCommand({
            ClientId: opts.clientId,
            AuthFlow: 'USER_AUTH',
            AuthParameters: { USERNAME: email, PREFERRED_CHALLENGE: 'EMAIL_OTP' },
          }),
        );
        if (res.ChallengeName !== 'EMAIL_OTP' || !res.Session) throw new AuthError('unavailable');
        return { email, session: res.Session };
      } catch (error) {
        throw error instanceof AuthError ? error : toAuthError(error);
      }
    },
    async verifyCode(challenge, code): Promise<SignedIn> {
      try {
        const res = await client.send(
          new RespondToAuthChallengeCommand({
            ClientId: opts.clientId,
            ChallengeName: 'EMAIL_OTP',
            Session: challenge.session,
            ChallengeResponses: { USERNAME: challenge.email, EMAIL_OTP_CODE: code },
          }),
        );
        const accessToken = res.AuthenticationResult?.AccessToken;
        if (!accessToken) throw new AuthError('wrong_code');
        return { email: challenge.email, accessToken };
      } catch (error) {
        throw error instanceof AuthError ? error : toAuthError(error);
      }
    },
  };
}
