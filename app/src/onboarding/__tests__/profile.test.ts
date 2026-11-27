import { DISPLAY_NAME_MAX } from '@huntclub/shared';

import { parseProfile } from '../profile';

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
