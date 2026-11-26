import { createTestDatabase } from '../../test-utils/nodeSqlite';
import { loadOnboardedAt, markOnboarded } from '../appState';
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
});
