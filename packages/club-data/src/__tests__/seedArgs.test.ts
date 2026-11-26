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

it('derives a display name and initials from an email', () => {
  expect(profileFromEmail('jane.doe@example.com')).toEqual({
    displayName: 'Jane Doe',
    initials: 'JD',
  });
  expect(profileFromEmail('uat@example.com')).toEqual({ displayName: 'Uat', initials: 'UA' });
});
