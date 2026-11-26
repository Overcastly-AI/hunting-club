import { DISPLAY_NAME_MAX, INITIALS_MAX } from '@huntclub/shared';

import { parseProfile, suggestInitials } from '../profile';

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

describe('parseProfile', () => {
  it('accepts and trims a valid name with initials', () => {
    expect(parseProfile({ displayName: '  Jake Smith ', initials: 'JS' })).toEqual({
      displayName: 'Jake Smith',
      initials: 'JS',
    });
  });

  it('rejects a blank name, missing initials or a name over the limit', () => {
    expect(parseProfile({ displayName: '   ', initials: 'JS' })).toBeNull();
    expect(parseProfile({ displayName: 'Jake', initials: '' })).toBeNull();
    expect(
      parseProfile({ displayName: 'J'.repeat(DISPLAY_NAME_MAX + 1), initials: 'J' }),
    ).toBeNull();
  });
});
