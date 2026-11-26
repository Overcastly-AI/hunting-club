/** Passwordless email-code sign-in (Cognito USER_AUTH + EMAIL_OTP), behind an interface. */
export interface CodeChallenge {
  readonly email: string;
  /** Opaque Cognito session for the challenge response. */
  readonly session: string;
}

export interface SignedIn {
  readonly email: string;
  readonly accessToken: string;
}

export interface AuthClient {
  /** True when the client talks to the real user pool (false: demo mode). */
  readonly live: boolean;
  /** Sends a 6-digit code to the email address. */
  requestCode(email: string): Promise<CodeChallenge>;
  /** Exchanges the code for tokens. Throws AuthError('wrong_code') on a bad code. */
  verifyCode(challenge: CodeChallenge, code: string): Promise<SignedIn>;
}

export type AuthErrorCode = 'unknown_user' | 'wrong_code' | 'too_many_attempts' | 'unavailable';

export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(code);
    this.name = 'AuthError';
  }
}

/** Six digits, as Cognito email codes are. */
export const CODE_PATTERN = /^\d{6}$/;
