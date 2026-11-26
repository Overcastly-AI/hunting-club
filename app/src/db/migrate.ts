import type { Migration, SqlDatabase } from './types';

/** Checks that migrations are numbered 1, 2, 3, … with no gaps or repeats. */
export function assertMigrationsOrdered(list: readonly Migration[]): void {
  list.forEach((migration, index) => {
    if (migration.version !== index + 1) {
      throw new Error(
        `Migration "${migration.name}" has version ${migration.version}; expected ${index + 1}.`,
      );
    }
  });
}

export async function getSchemaVersion(db: SqlDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/**
 * Applies every migration newer than the database's `PRAGMA user_version`,
 * each in its own transaction. Returns the resulting schema version.
 */
export async function migrate(db: SqlDatabase, list: readonly Migration[]): Promise<number> {
  assertMigrationsOrdered(list);
  const current = await getSchemaVersion(db);
  const latest = list.length;
  if (current > latest) {
    throw new Error(
      `Database schema version ${current} is newer than this app supports (${latest}).`,
    );
  }

  for (const migration of list.slice(current)) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.sql);
      // PRAGMA does not accept bound parameters; version is a checked integer.
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
  return getSchemaVersion(db);
}
