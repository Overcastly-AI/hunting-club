import { idSchema, INITIALS_MAX, suggestInitials, userIdSchema } from '../fields';

it('accepts real Cognito subs, including ones without RFC 9562 variant bits', () => {
  // A dev pool sub whose 4th group starts with "f" (failed z.uuid(); seed:dev, Request #9).
  expect(userIdSchema.safeParse('64d824c8-a0d1-70a9-fdfc-1f8138e91b49').success).toBe(true);
  expect(userIdSchema.safeParse('2b6f1c3e-9a4d-4e8b-8f0a-1c2d3e4f5a6b').success).toBe(true);
});

it('still rejects anything that is not 8-4-4-4-12 hex', () => {
  for (const bad of [
    '',
    'user-1',
    '64d824c8a0d170a9fdfc1f8138e91b49',
    '64d824c8-a0d1-70a9-fdfc-1f8138e91b4z',
  ]) {
    expect(userIdSchema.safeParse(bad).success).toBe(false);
  }
});

it('keeps our own ids as RFC UUIDs', () => {
  expect(idSchema.safeParse(crypto.randomUUID()).success).toBe(true);
});

describe('suggestInitials', () => {
  it.each([
    ['Jake Smith', 'JS'],
    ['  jake   smith ', 'JS'],
    ['Mary Ann Lee Jones', 'MAL'],
    ['Jake', 'J'],
    ['Élodie Ørsted', 'ÉØ'],
    ['"Bud" O’Neil', 'BO'],
    ['', ''],
  ])('%j → %j', (name, initials) => {
    expect(suggestInitials(name)).toBe(initials);
  });

  it('never suggests more than the shared limit', () => {
    expect(suggestInitials('a b c d e f').length).toBe(INITIALS_MAX);
  });
});
