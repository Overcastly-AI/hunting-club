/**
 * The small slice of the expo-sqlite database API the app's data layer uses.
 * Keeping it narrow lets tests run the same code against an in-memory SQLite
 * engine in Node.
 */
export type SqlValue = string | number | null | Uint8Array;

export interface SqlDatabase {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: SqlValue[]): Promise<unknown>;
  getFirstAsync<T>(source: string, ...params: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(source: string, ...params: SqlValue[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

export interface Migration {
  /** Becomes `PRAGMA user_version` once applied. Start at 1, no gaps. */
  version: number;
  name: string;
  sql: string;
}
