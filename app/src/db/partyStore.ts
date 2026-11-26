import type { PartyStore, StoredParty } from '@huntclub/core';

import type { SqlDatabase } from './types';

/** core's PartyStore on the phone's SQLite database (one row, JSON). */
export function sqlitePartyStore(db: SqlDatabase): PartyStore {
  return {
    async load() {
      const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM party WHERE id = 1');
      return row ? (JSON.parse(row.data) as StoredParty) : null;
    },
    async save(party) {
      await db.runAsync(
        `INSERT INTO party (id, data) VALUES (1, ?)
         ON CONFLICT (id) DO UPDATE SET data = excluded.data`,
        JSON.stringify(party),
      );
    },
    async clear() {
      await db.runAsync('DELETE FROM party');
    },
  };
}
