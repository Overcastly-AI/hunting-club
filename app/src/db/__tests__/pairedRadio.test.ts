import { createTestDatabase } from '../../test-utils/nodeSqlite';
import { migrate } from '../migrate';
import { migrations } from '../migrations';
import { clearPairedRadio, loadPairedRadio, savePairedRadio } from '../pairedRadio';

async function migratedDb() {
  const db = createTestDatabase();
  await migrate(db, migrations);
  return db;
}

describe('paired radio', () => {
  it('starts empty, saves, replaces and clears the one paired radio', async () => {
    const db = await migratedDb();
    expect(await loadPairedRadio(db)).toBeNull();

    await savePairedRadio(db, { peripheralId: 'AA:BB', name: 'Meshtastic 1a2b', pairedAt: 1 });
    await savePairedRadio(db, { peripheralId: 'CC:DD', name: 'Meshtastic 3c4d', pairedAt: 2 });
    expect(await loadPairedRadio(db)).toEqual({
      peripheralId: 'CC:DD',
      name: 'Meshtastic 3c4d',
      pairedAt: 2,
    });

    await clearPairedRadio(db);
    expect(await loadPairedRadio(db)).toBeNull();
  });
});
