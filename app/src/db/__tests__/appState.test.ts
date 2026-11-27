import { createTestDatabase } from '../../test-utils/nodeSqlite';
import {
  loadNameSkippedAt,
  loadOnboardedAt,
  loadProfile,
  loadThemePreference,
  markNameSkipped,
  markOnboarded,
  saveProfile,
  saveThemePreference,
} from '../appState';
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

  it('remembers when the hunter skipped the name prompt', async () => {
    const db = createTestDatabase();
    await migrate(db, migrations);
    expect(await loadNameSkippedAt(db)).toBeNull();

    await markNameSkipped(db, 5_678);
    expect(await loadNameSkippedAt(db)).toBe(5_678);
  });

  it('starts on the System theme and remembers the hunter’s choice', async () => {
    const db = createTestDatabase();
    await migrate(db, migrations);
    expect(await loadThemePreference(db)).toBe('system');

    await saveThemePreference(db, 'light');
    expect(await loadThemePreference(db)).toBe('light');
  });

  it('refuses a theme that is not System, Dark or Light', async () => {
    const db = createTestDatabase();
    await migrate(db, migrations);
    await expect(db.runAsync("UPDATE app_state SET theme_preference = 'sepia'")).rejects.toThrow(
      /CHECK/,
    );
  });
});
