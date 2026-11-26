// The words of the email-code sign-in, shared by the app and the web admin so both
// say the same thing. Plain language; no passwords.
import type { CognitoAuthErrorCode } from './cognito';

/** Digits in the emailed one-time code (Cognito EMAIL_OTP and sign-up codes). */
export const EMAIL_CODE_LENGTH = 6;

/** How long an emailed sign-in code works: Cognito EMAIL_OTP codes expire after 3 minutes. */
export const EMAIL_CODE_VALID_MINUTES = 3;

export const signInCopy = {
  title: 'Sign in',
  intro: `We email you a ${EMAIL_CODE_LENGTH}-digit code. No password to remember.`,
  email: 'Email address',
  emailPlaceholder: 'you@example.com',
  sendCode: 'Email me a code',
  sending: 'Sending code…',
  codeSent: (email: string) => `Enter the code we sent to ${email}.`,
  codeHelp: `The code works for ${EMAIL_CODE_VALID_MINUTES} minutes. Not in your inbox? Check your spam folder.`,
  code: `${EMAIL_CODE_LENGTH}-digit code`,
  codeIncomplete: `Enter all ${EMAIL_CODE_LENGTH} digits of the code.`,
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
