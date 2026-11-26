import { createMigratedTestDatabase } from '../../test-utils/nodeSqlite';
import {
  deleteMapPack,
  insertMapPack,
  listMapPacks,
  updateMapPackProgress,
  type MapPack,
} from '../mapPacks';

const pack = (id: string, createdAt: number): MapPack => ({
  id,
  name: 'Home farm',
  bounds: [-77.866, 40.786, -77.854, 40.795],
  minZoom: 8,
  maxZoom: 15,
  source: 'usgs-topo',
  sizeBytes: null,
  tileCount: null,
  status: 'downloading',
  createdAt,
  downloadedAt: null,
});

describe('map pack storage', () => {
  it('stores, updates, lists newest first and deletes packs', async () => {
    const db = await createMigratedTestDatabase();
    await insertMapPack(db, pack('a', 1));
    await insertMapPack(db, pack('b', 2));

    await updateMapPackProgress(db, 'a', {
      status: 'complete',
      sizeBytes: 1_234_567,
      tileCount: 321,
      downloadedAt: 10,
    });

    const listed = await listMapPacks(db);
    expect(listed.map((p) => p.id)).toEqual(['b', 'a']);
    expect(listed[1]).toEqual({
      ...pack('a', 1),
      status: 'complete',
      sizeBytes: 1_234_567,
      tileCount: 321,
      downloadedAt: 10,
    });

    await deleteMapPack(db, 'b');
    expect((await listMapPacks(db)).map((p) => p.id)).toEqual(['a']);
  });
});
