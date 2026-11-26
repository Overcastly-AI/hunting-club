import type { SQLiteDatabase } from 'expo-sqlite';

import { migrate } from './migrate';
import { migrations } from './migrations';

export { migrate, getSchemaVersion } from './migrate';
export { migrations } from './migrations';
export type { Migration, SqlDatabase, SqlValue } from './types';

/** File name of the on-device database. */
export const DATABASE_NAME = 'huntclub.db';

/**
 * Prepares a freshly opened database: connection settings, then migrations.
 * Pass it to `<SQLiteProvider onInit={initDatabase}>`.
 */
export async function initDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await migrate(db, migrations);
}
