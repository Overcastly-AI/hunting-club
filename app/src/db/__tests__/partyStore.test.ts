import type { StoredParty } from '@huntclub/core';

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

describe('sqlitePartyStore', () => {
  it('saves, replaces, loads and clears the one party', async () => {
    const db = createTestDatabase();
    await migrate(db, migrations);
    const store = sqlitePartyStore(db);
    expect(await store.load()).toBeNull();

    await store.save(PARTY);
    await store.save({ ...PARTY, role: 'member' });
    expect(await store.load()).toEqual({ ...PARTY, role: 'member' });

    await store.clear();
    expect(await store.load()).toBeNull();
  });
});
