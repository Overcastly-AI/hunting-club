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
