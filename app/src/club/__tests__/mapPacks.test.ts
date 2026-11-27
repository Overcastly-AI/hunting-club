// Club map packs: downloading the newest ready pack per source, offline-safe.
import { BASEMAPS, DAY_MS, type MapPack, mapPackUrl } from '@huntclub/shared';

import { migrate } from '../../db/migrate';
import { migrations } from '../../db/migrations';
import { CLUB_ID, fakeClubApi, mapPack } from '../../test-utils/fakeClubApi';
import { createTestDatabase } from '../../test-utils/nodeSqlite';
import { type MapPackFiles, loadClubMapPacks, syncClubMapPacks } from '../mapPacks';

const NOW = Date.parse('2026-11-26T12:00:00Z');
const LATER = NOW + DAY_MS;

/** Files on a pretend phone: a download "saves" to file:///packs/<id>.pmtiles. */
function fakeFiles() {
  const saved = new Set<string>();
  let failing = false;
  const files = {
    download: jest.fn(async (_url: string, packId: string) => {
      if (failing) throw new Error('network');
      const uri = `file:///packs/${packId}.pmtiles`;
      saved.add(uri);
      return uri;
    }),
    remove: jest.fn(async (uri: string) => void saved.delete(uri)),
  } satisfies MapPackFiles;
  return { files, saved, fail: (on: boolean) => (failing = on) };
}

async function setup(packs: () => MapPack[], options: { offline?: boolean } = {}) {
  const db = createTestDatabase();
  await migrate(db, migrations);
  const api = fakeClubApi({ mapPacks: packs, ...options });
  const phone = fakeFiles();
  const sync = (now = NOW) => syncClubMapPacks(db, api, phone.files, 'dev', CLUB_ID, now);
  return { db, api, phone, sync };
}

it('downloads the newest ready pack per source and skips building and failed ones', async () => {
  const aerial = BASEMAPS.aerial.source;
  const { db, phone, sync } = await setup(() => [
    mapPack('old', { builtAt: '2026-11-01T00:00:00.000Z' }),
    mapPack('new'),
    mapPack('img', { source: aerial }),
    mapPack('wip', { status: 'building', expiresAt: '2026-11-27T00:00:00.000Z' }),
    mapPack('bad', { source: 'usgs-other', status: 'failed', reason: 'Too big' }),
  ]);

  expect(await sync()).toEqual({ downloaded: ['new', 'img'], failed: [] });
  expect(phone.files.download).toHaveBeenCalledWith(mapPackUrl('dev', mapPack('new')), 'new');
  expect(await loadClubMapPacks(db)).toEqual([
    expect.objectContaining({ source: aerial, packId: 'img' }),
    {
      clubId: CLUB_ID,
      source: BASEMAPS.topo.source,
      packId: 'new',
      bounds: mapPack('new').bounds,
      minZoom: 10,
      maxZoom: 16,
      sizeBytes: 48_000_000,
      builtAt: '2026-11-20T08:00:00.000Z',
      localUri: 'file:///packs/new.pmtiles',
      downloadedAt: NOW,
    },
  ]);
  expect([...phone.saved].sort()).toEqual([
    'file:///packs/img.pmtiles',
    'file:///packs/new.pmtiles',
  ]);
});

it('skips a pack it already has', async () => {
  const { phone, sync } = await setup(() => [mapPack('p1')]);
  await sync();
  expect(await sync(LATER)).toEqual({ downloaded: [], failed: [] });
  expect(phone.files.download).toHaveBeenCalledTimes(1);
});

it('replaces a rebuilt pack and removes the old file', async () => {
  let packs = [mapPack('p1')];
  const { db, phone, sync } = await setup(() => packs);
  await sync();
  packs = [mapPack('p1'), mapPack('p2', { builtAt: '2026-11-25T00:00:00.000Z' })];

  expect(await sync(LATER)).toEqual({ downloaded: ['p2'], failed: [] });
  expect(await loadClubMapPacks(db)).toEqual([
    expect.objectContaining({ packId: 'p2', downloadedAt: LATER }),
  ]);
  expect([...phone.saved]).toEqual(['file:///packs/p2.pmtiles']);
});

it('keeps the pack on the phone when the new one fails to download', async () => {
  let packs = [mapPack('p1')];
  const { db, phone, sync } = await setup(() => packs);
  await sync();
  packs = [mapPack('p2', { builtAt: '2026-11-25T00:00:00.000Z' })];
  phone.fail(true);

  const result = await sync(LATER);
  expect(result.downloaded).toEqual([]);
  expect(result.failed).toEqual([{ packId: 'p2', error: expect.any(Error) }]);
  expect(await loadClubMapPacks(db)).toEqual([expect.objectContaining({ packId: 'p1' })]);
  expect(phone.files.remove).not.toHaveBeenCalled();
});

it('changes nothing offline', async () => {
  const { db, phone, sync } = await setup(() => [mapPack('p1')], { offline: true });
  await expect(sync()).rejects.toThrow();
  expect(phone.files.download).not.toHaveBeenCalled();
  expect(await loadClubMapPacks(db)).toEqual([]);
});
