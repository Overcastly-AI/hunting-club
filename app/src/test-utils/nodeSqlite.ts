import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import { migrate } from '../db/migrate';
import { migrations } from '../db/migrations';
import type { SqlDatabase, SqlValue } from '../db/types';

/**
 * An in-memory SQLite database (Node's built-in engine) behind the same
 * interface the app uses with expo-sqlite, so migrations run as real SQL in tests.
 */
export function createTestDatabase(): SqlDatabase & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  return {
    raw,
    async execAsync(source) {
      raw.exec(source);
    },
    async runAsync(source: string, ...params: SqlValue[]) {
      return raw.prepare(source).run(...(params as SQLInputValue[]));
    },
    async getAllAsync<T>(source: string, ...params: SqlValue[]) {
      return raw.prepare(source).all(...(params as SQLInputValue[])) as T[];
    },
    async getFirstAsync<T>(source: string, ...params: SqlValue[]) {
      const row = raw.prepare(source).get(...(params as SQLInputValue[]));
      return (row as T | undefined) ?? null;
    },
    async withTransactionAsync(task) {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

/** A test database with every app migration applied. */
export async function createMigratedTestDatabase(): Promise<ReturnType<typeof createTestDatabase>> {
  const db = createTestDatabase();
  await migrate(db, migrations);
  return db;
}
