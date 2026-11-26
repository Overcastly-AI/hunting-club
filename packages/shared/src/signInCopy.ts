// The words of the email-code sign-in, shared by the app and the web admin so both
// say the same thing. Plain language; no passwords.
import type { CodeChallenge, CognitoAuthErrorCode } from './cognito';

/** Digits in the code Cognito emails to confirm a new account (sign-up). */
export const SIGN_UP_CODE_LENGTH = 6;
/** Digits in the code Cognito emails to sign in an existing account (EMAIL_OTP). */
export const EMAIL_OTP_CODE_LENGTH = 8;

/**
 * Minutes an EMAIL_OTP sign-in code works: the user pool client's AuthSessionValidity
 * (10 minutes, Request #11), which is also the EMAIL_OTP lifetime.
 */
export const EMAIL_OTP_VALID_MINUTES = 10;

/** The emailed code for a challenge: how many digits, and how long it works (in words). */
export interface EmailCodeRules {
  readonly length: number;
  readonly validFor: string;
}

const CODE_RULES: Record<CodeChallenge['kind'], EmailCodeRules> = {
  // Cognito: sign-up confirmation codes last 24 hours; EMAIL_OTP sign-in codes last the
  // session validity (EMAIL_OTP_VALID_MINUTES).
  signUp: { length: SIGN_UP_CODE_LENGTH, validFor: '24 hours' },
  signIn: { length: EMAIL_OTP_CODE_LENGTH, validFor: `${EMAIL_OTP_VALID_MINUTES} minutes` },
};

/** The one place the expected code depends on the challenge kind. */
export function emailCodeRules(kind: CodeChallenge['kind']): EmailCodeRules {
  return CODE_RULES[kind];
}

export const signInCopy = {
  title: 'Sign in',
  intro: 'We email you a code. No password to remember.',
  email: 'Email address',
  emailPlaceholder: 'you@example.com',
  sendCode: 'Email me a code',
  sending: 'Sending code… this can take a few seconds',
  codeSent: (email: string) => `Enter the code from the email we sent to ${email}.`,
  codeHelp: (kind: CodeChallenge['kind']) =>
    `The code works for ${emailCodeRules(kind).validFor}. Not in your inbox? Check your spam folder.`,
  code: 'Code from the email',
  codeIncomplete: (kind: CodeChallenge['kind']) =>
    `Enter all ${emailCodeRules(kind).length} digits of the code from the email.`,
  confirm: 'Sign in',
  signingIn: 'Signing in…',
  resend: 'Send a new code',
  resent: 'We sent a new code.',
  useOtherEmail: 'Use a different email',
  errors: {
    wrong_code: 'That code is not right. Check the email and try again.',
    code_expired: 'That code has expired. Ask for a new one.',
    too_many_attempts: 'Too many tries. Wait a few minutes, then try again.',
    invalid_email: 'Check the email address.',
    network: 'No connection. Try again when you have signal.',
    unknown: 'Something went wrong. Try again.',
  } satisfies Record<CognitoAuthErrorCode, string>,
} as const;

/** What a typed or pasted code becomes: digits only, nothing cut off (checked on submit). */
export const codeDigits = (input: string) => input.replace(/\D/g, '');
