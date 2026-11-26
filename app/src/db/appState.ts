import { DEFAULT_THEME_PREFERENCE, type ThemePreference } from '@huntclub/design';
import type { MemberJoin } from '@huntclub/shared';

import type { SqlDatabase } from './types';

/** When this phone finished onboarding (ms since epoch), or null if it hasn't. */
export async function loadOnboardedAt(db: SqlDatabase): Promise<number | null> {
  const row = await db.getFirstAsync<{ onboarded_at: number | null }>(
    'SELECT onboarded_at FROM app_state WHERE id = 1',
  );
  return row?.onboarded_at ?? null;
}

export async function markOnboarded(db: SqlDatabase, at: number): Promise<void> {
  await db.runAsync('UPDATE app_state SET onboarded_at = ? WHERE id = 1', at);
}

/** The hunter's own name and initials, as entered during onboarding. */
export type MyProfile = Pick<MemberJoin, 'displayName' | 'initials'>;

export async function loadProfile(db: SqlDatabase): Promise<MyProfile | null> {
  const row = await db.getFirstAsync<{ display_name: string | null; initials: string | null }>(
    'SELECT display_name, initials FROM app_state WHERE id = 1',
  );
  return row?.display_name && row.initials
    ? { displayName: row.display_name, initials: row.initials }
    : null;
}

export async function saveProfile(db: SqlDatabase, profile: MyProfile): Promise<void> {
  await db.runAsync(
    'UPDATE app_state SET display_name = ?, initials = ? WHERE id = 1',
    profile.displayName,
    profile.initials,
  );
}

/** System (follow the phone), Dark or Light, as the hunter chose it in Settings. */
export async function loadThemePreference(db: SqlDatabase): Promise<ThemePreference> {
  const row = await db.getFirstAsync<{ theme_preference: ThemePreference }>(
    'SELECT theme_preference FROM app_state WHERE id = 1',
  );
  return row?.theme_preference ?? DEFAULT_THEME_PREFERENCE;
}

export async function saveThemePreference(
  db: SqlDatabase,
  preference: ThemePreference,
): Promise<void> {
  await db.runAsync('UPDATE app_state SET theme_preference = ? WHERE id = 1', preference);
}
