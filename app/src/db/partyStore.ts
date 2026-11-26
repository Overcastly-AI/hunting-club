import type { PartyStore, StoredParty } from '@huntclub/core';

import { SECURE_KEYS, secureStorage, type SecureStorage } from '../storage/secure';
import type { SqlDatabase } from './types';

const JOIN_LINK = SECURE_KEYS.partyJoinLink;

/** What goes in SQLite: the party without its join link. */
type PartyRow = Omit<StoredParty, 'joinLink'> & { joinLink?: string };

/**
 * core's PartyStore on the phone: the party in SQLite (one row, JSON) and its
 * join link, which holds the channel key, in secure storage.
 */
export function sqlitePartyStore(
  db: SqlDatabase,
  secure: SecureStorage = secureStorage,
): PartyStore {
  const store: PartyStore = {
    async load() {
      const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM party WHERE id = 1');
      if (!row) return null;
      const { joinLink: legacyLink, ...party } = JSON.parse(row.data) as PartyRow;
      if (legacyLink) {
        // Saved before the link moved to secure storage: move it now.
        const moved = { ...party, joinLink: legacyLink };
        await store.save(moved);
        return moved;
      }
      const joinLink = await secure.get(JOIN_LINK);
      if (!joinLink) {
        // Without its key the party can't be used; start clean.
        await store.clear();
        return null;
      }
      return { ...party, joinLink };
    },
    async save({ joinLink, ...party }) {
      await secure.set(JOIN_LINK, joinLink);
      await db.runAsync(
        `INSERT INTO party (id, data) VALUES (1, ?)
         ON CONFLICT (id) DO UPDATE SET data = excluded.data`,
        JSON.stringify(party),
      );
    },
    async clear() {
      await db.runAsync('DELETE FROM party');
      await secure.delete(JOIN_LINK);
    },
  };
  return store;
}
