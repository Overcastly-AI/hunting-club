import { createTestDatabase } from '../../test-utils/nodeSqlite';
import { loadOnboardedAt, loadProfile, markOnboarded, saveProfile } from '../appState';
import { migrate } from '../migrate';
import { migrations } from '../migrations';

describe('app state', () => {
  it('starts not onboarded and remembers when onboarding finished', async () => {
    const db = createTestDatabase();
    await migrate(db, migrations);
    expect(await loadOnboardedAt(db)).toBeNull();

    await markOnboarded(db, 1_234);
    expect(await loadOnboardedAt(db)).toBe(1_234);
  });

  it('stores the hunter’s name and initials', async () => {
    const db = createTestDatabase();
    await migrate(db, migrations);
    expect(await loadProfile(db)).toBeNull();

    await saveProfile(db, { displayName: 'Jake Smith', initials: 'JS' });
    expect(await loadProfile(db)).toEqual({ displayName: 'Jake Smith', initials: 'JS' });
  });
});
