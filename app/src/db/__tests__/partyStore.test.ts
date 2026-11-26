import type { StoredParty } from '@huntclub/core';

import { SECURE_KEYS } from '../../storage/secure';
import { memorySecureStorage } from '../../test-utils/memorySecureStorage';
import { createTestDatabase } from '../../test-utils/nodeSqlite';
import { migrate } from '../migrate';
import { migrations } from '../migrations';
import { sqlitePartyStore } from '../partyStore';

const PARTY: StoredParty = {
  id: 'abcdEFGH',
  joinLink: 'huntclub://join?x',
  role: 'creator',
  joinedAt: 1,
  channelIndex: 0,
  members: [{ node: 7, firstHeard: 2, lastHeard: 3 }],
};

async function setUp() {
  const db = createTestDatabase();
  await migrate(db, migrations);
  const secure = memorySecureStorage();
  const sqlRow = async () =>
    (await db.getFirstAsync<{ data: string }>('SELECT data FROM party WHERE id = 1'))?.data;
  return { db, secure, sqlRow, store: sqlitePartyStore(db, secure) };
}

describe('sqlitePartyStore', () => {
  it('saves, replaces, loads and clears the one party', async () => {
    const { store, secure } = await setUp();
    expect(await store.load()).toBeNull();

    await store.save(PARTY);
    await store.save({ ...PARTY, role: 'member' });
    expect(await store.load()).toEqual({ ...PARTY, role: 'member' });

    await store.clear();
    expect(await store.load()).toBeNull();
    expect(secure.values.size).toBe(0);
  });

  it('keeps the join link (channel key) in secure storage, never in SQLite', async () => {
    const { store, secure, sqlRow } = await setUp();
    await store.save(PARTY);

    expect(secure.values.get(SECURE_KEYS.partyJoinLink)).toBe(PARTY.joinLink);
    expect(await sqlRow()).not.toContain(PARTY.joinLink);
  });

  it('moves a join link saved in SQLite by an earlier build to secure storage', async () => {
    const { db, store, secure, sqlRow } = await setUp();
    await db.runAsync('INSERT INTO party (id, data) VALUES (1, ?)', JSON.stringify(PARTY));

    expect(await store.load()).toEqual(PARTY);
    expect(secure.values.get(SECURE_KEYS.partyJoinLink)).toBe(PARTY.joinLink);
    expect(await sqlRow()).not.toContain(PARTY.joinLink);
  });

  it('drops a party whose join link is gone', async () => {
    const { store, secure, sqlRow } = await setUp();
    await store.save(PARTY);
    secure.values.clear();

    expect(await store.load()).toBeNull();
    expect(await sqlRow()).toBeUndefined();
  });
});
