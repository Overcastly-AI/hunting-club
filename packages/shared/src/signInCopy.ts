// The words of the email-code sign-in, shared by the app and the web admin so both
// say the same thing. Plain language; no passwords.
import type { CognitoAuthErrorCode } from './cognito';

/** Digits in the emailed one-time code (Cognito EMAIL_OTP and sign-up codes). */
export const EMAIL_CODE_LENGTH = 6;

export const signInCopy = {
  title: 'Sign in',
  intro: `We email you a ${EMAIL_CODE_LENGTH}-digit code. No password to remember.`,
  email: 'Email address',
  sendCode: 'Email me a code',
  sending: 'Sending…',
  codeSent: (email: string) => `Enter the code we sent to ${email}.`,
  code: `${EMAIL_CODE_LENGTH}-digit code`,
  confirm: 'Sign in',
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
