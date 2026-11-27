import { isEmailStandInName, NAMELESS_STAND_IN } from '@huntclub/shared';
import { parseSeedArgs } from '../seed/cli';
import { profileFromEmail } from '../seed/devClub';

const args = (over: Record<string, string> = {}) =>
  Object.entries({
    env: 'dev',
    table: 'hunt-club-mesh-dev',
    'admin-sub': 'sub-1',
    email: 'a@b.c',
    ...over,
  }).flatMap(([k, v]) => [`--${k}`, v]);

describe('seed:dev arguments', () => {
  it('accepts the dev environment and table', () => {
    expect(parseSeedArgs(args())).toEqual({
      table: 'hunt-club-mesh-dev',
      adminSub: 'sub-1',
      email: 'a@b.c',
    });
  });

  it('refuses any other environment or table', () => {
    expect(() => parseSeedArgs(args({ env: 'prod' }))).toThrow('--env must be "dev"');
    expect(() => parseSeedArgs(args({ table: 'hunt-club-mesh-prod' }))).toThrow('dev table');
  });

  it('needs the admin sub and email', () => {
    expect(() => parseSeedArgs(args().slice(0, 4))).toThrow('required');
  });
});

it('takes the display name from an email exactly as typed, and initials from its words', () => {
  expect(profileFromEmail('jane.doe@example.com')).toEqual({
    displayName: 'jane.doe',
    initials: 'JD',
  });
  // Never split and title-cased ("Jonesjaycob Uitest").
  expect(profileFromEmail('jonesjaycob.uitest@example.com')).toEqual({
    displayName: 'jonesjaycob.uitest',
    initials: 'JU',
  });
  expect(profileFromEmail('uat@example.com')).toEqual({ displayName: 'uat', initials: 'U' });
  // A local part the name rules refuse still stands in, as near as typed, never a made-up name;
  // the stand-in check knows each one, so the web asks the admin for their name.
  for (const [email, displayName, initials] of [
    ['jane_doe+uat@example.com', 'jane.doe.uat', 'JDU'],
    ['@example.com', NAMELESS_STAND_IN, 'M'],
  ] as const) {
    expect(profileFromEmail(email)).toEqual({ displayName, initials });
    expect(isEmailStandInName(displayName, email)).toBe(true);
  }
});
