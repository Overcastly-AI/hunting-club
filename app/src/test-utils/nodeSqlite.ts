import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

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
