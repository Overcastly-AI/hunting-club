// Map-pack builds: one at a time per club, building → ready | failed, and a lock that
// expires so a builder that died never blocks the club.
import { MAP_PACK_BUILD, MAP_PACK_REASON_MAX, type MapPackStart } from '@huntclub/shared';
import { SERVICE } from '../index';
import { World, expectCode } from '../testing/world';

let w: World;
const oak = () => w.club('Oak Ridge');
const PACK: MapPackStart = {
  bounds: [-90, 40, -89.9, 40.1],
  minZoom: 8,
  maxZoom: 15,
  source: 'usgs-topo',
};
const start = () => w.data.startMapPackBuild(w.as('ada'), oak(), PACK);
const ready = () => ({ sizeBytes: 2048, builtAt: w.clock.inDays(0) });
const statuses = async () =>
  Object.fromEntries((await w.data.listMapPacks(w.as('max'), oak())).map((p) => [p.id, p.status]));

beforeEach(async () => {
  w = await World.seedTwoClubs();
});
afterEach(() => w.destroy());

describe('map pack builds', () => {
  it('starts as building, blocks a second build, and frees the club when ready', async () => {
    const pack = await start();
    expect(pack).toMatchObject({ status: 'building', s3Key: `packs/${oak()}/${pack.id}.pmtiles` });
    await expectCode(start(), 'conflict');

    const done = await w.data.finishMapPack(SERVICE, oak(), pack.id, ready());
    expect(done).toMatchObject({ status: 'ready', sizeBytes: 2048 });
    expect(done).not.toHaveProperty('expiresAt');
    const next = await start();
    expect(await statuses()).toEqual({ [pack.id]: 'ready', [next.id]: 'building' });
  });

  it('records a short failure reason and frees the club', async () => {
    const pack = await start();
    const failed = await w.data.failMapPack(SERVICE, oak(), pack.id, 'x'.repeat(500));
    expect(failed).toMatchObject({ status: 'failed' });
    expect(failed.status === 'failed' && failed.reason).toHaveLength(MAP_PACK_REASON_MAX);
    await expect(start()).resolves.toMatchObject({ status: 'building' });
  });

  it('settles a build only once', async () => {
    const pack = await start();
    await w.data.finishMapPack(SERVICE, oak(), pack.id, ready());
    await expectCode(w.data.failMapPack(SERVICE, oak(), pack.id, 'late'), 'not_found');
  });

  it('lets a new build start once a dead build has timed out, and shows it as failed', async () => {
    const dead = await start();
    w.clock.advance(MAP_PACK_BUILD.lockSeconds * 1000 + 1000);
    const next = await start();
    const packs = await w.data.listMapPacks(w.as('max'), oak());
    expect(packs.find((p) => p.id === dead.id)).toMatchObject({ status: 'failed' });
    // The dead build finishing late leaves the new build's lock alone.
    await w.data.finishMapPack(SERVICE, oak(), dead.id, ready()).catch(() => undefined);
    await expectCode(start(), 'conflict');
    expect(await statuses()).toMatchObject({ [next.id]: 'building' });
  });

  it('runs one build at a time across all clubs', async () => {
    const pine = () => w.data.startMapPackBuild(w.as('pat'), w.club('Pine Hollow'), PACK);
    const pack = await start();
    await expectCode(pine(), 'conflict');
    await w.data.finishMapPack(SERVICE, oak(), pack.id, ready());
    await expect(pine()).resolves.toMatchObject({ status: 'building' });
    await expectCode(start(), 'conflict');
  });
});
