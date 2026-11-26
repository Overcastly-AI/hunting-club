import {
  codeDigits,
  emailCodeRules,
  EMAIL_OTP_CODE_LENGTH,
  SIGN_UP_CODE_LENGTH,
  signInCopy,
} from '../signInCopy';

describe('emailed code rules', () => {
  it('follow the challenge: 6-digit sign-up codes for 24 hours, 8-digit sign-in codes for 3 minutes', () => {
    expect(emailCodeRules('signUp')).toEqual({ length: SIGN_UP_CODE_LENGTH, validFor: '24 hours' });
    expect(emailCodeRules('signIn')).toEqual({
      length: EMAIL_OTP_CODE_LENGTH,
      validFor: '3 minutes',
    });
    expect([SIGN_UP_CODE_LENGTH, EMAIL_OTP_CODE_LENGTH]).toEqual([6, 8]);
  });

  it('word the copy per kind, and never name a fixed length up front', () => {
    expect(signInCopy.codeSent('a@b.co')).toBe('Enter the code from the email we sent to a@b.co.');
    expect(signInCopy.codeIncomplete('signUp')).toContain('6 digits');
    expect(signInCopy.codeIncomplete('signIn')).toContain('8 digits');
    expect(signInCopy.codeHelp('signUp')).toContain('24 hours');
    expect(signInCopy.intro).not.toMatch(/\d/);
  });

  it('keep every digit of a paste and drop everything else', () => {
    expect(codeDigits(' 1234 5678-9 ')).toBe('123456789');
  });
});
