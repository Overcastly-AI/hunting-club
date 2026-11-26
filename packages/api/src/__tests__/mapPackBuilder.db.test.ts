// The map-pack builder end to end: fake USGS tiles → PMTiles archive → "S3" → the
// club's map_pack item on DynamoDB Local. No network.
import { SERVICE } from '@huntclub/club-data';
import { World } from '@huntclub/club-data/testing';
import { MAP_PACKS_PREFIX, countTiles, type Bounds } from '@huntclub/shared';
import { TILE_FETCH_POLICY, buildMapPack, politeTileFetcher } from '../mapPackBuilder';

const BOUNDS: Bounds = [-90.01, 40.0, -89.99, 40.02];
const PACK_ID = '00000000-0000-4000-8000-0000000000b1';
let w: World;

beforeAll(async () => {
  w = await World.seedTwoClubs();
});
afterAll(() => w.destroy());

/** Reads the PMTiles v3 header fields we care about. */
const header = (archive: Buffer) => ({
  magic: archive.subarray(0, 7).toString('ascii'),
  version: archive.readUInt8(7),
  addressedTiles: Number(archive.readBigUInt64LE(72)),
  tileType: archive.readUInt8(99),
});

it('fetches every tile of the property, writes a PMTiles archive and records the pack', async () => {
  const urls: string[] = [];
  const stored = new Map<string, Buffer>();
  const pack = await buildMapPack(
    {
      clubId: w.club('Oak Ridge'),
      packId: PACK_ID,
      basemap: 'topo',
      bounds: BOUNDS,
      minZoom: 12,
      maxZoom: 13,
    },
    {
      data: w.data,
      fetchTile: async (url) => {
        urls.push(url);
        return url.endsWith('/0/0') ? null : Buffer.from(`jpeg ${url}`);
      },
      putObject: async (key, body) => void stored.set(key, body),
    },
  );
  expect(urls).toHaveLength(countTiles(BOUNDS, 12, 13));
  expect(urls[0]).toMatch(
    /^https:\/\/basemap\.nationalmap\.gov\/.+\/USGSTopo\/MapServer\/tile\/13\/\d+\/\d+$/,
  );
  const key = `${MAP_PACKS_PREFIX}${w.club('Oak Ridge')}/${PACK_ID}.pmtiles`;
  const archive = stored.get(key)!;
  expect(header(archive)).toEqual({
    magic: 'PMTiles',
    version: 3,
    addressedTiles: urls.length,
    tileType: 3,
  });
  expect(pack).toMatchObject({
    id: PACK_ID,
    s3Key: key,
    source: 'usgs-topo',
    sizeBytes: archive.length,
    minZoom: 12,
    maxZoom: 13,
  });
  expect(await w.data.listMapPacks(w.as('max'), w.club('Oak Ridge'))).toEqual([pack]);
});

it('refuses a build over the size caps without fetching anything', async () => {
  const fetchTile = jest.fn();
  await expect(
    buildMapPack(
      {
        clubId: w.club('Oak Ridge'),
        packId: PACK_ID,
        basemap: 'aerial',
        bounds: [-91, 39, -89, 41],
        minZoom: 8,
        maxZoom: 15,
      },
      { data: w.data, fetchTile, putObject: jest.fn() },
    ),
  ).rejects.toThrow('over the tiles limit');
  expect(fetchTile).not.toHaveBeenCalled();
});

describe('politeTileFetcher', () => {
  const response = (status: number) => ({
    status,
    arrayBuffer: async () => new Uint8Array([1, 2]).buffer,
  });

  it('retries 429/5xx with backoff, gives null for 404 and fails on other errors', async () => {
    const statuses = [503, 429, 200, 404, 400];
    const sleeps: number[] = [];
    const fetchTile = politeTileFetcher({
      fetch: async () => response(statuses.shift()!),
      userAgent: 'test',
      sleep: async (ms) => void sleeps.push(ms),
      now: () => 0,
    });
    expect(await fetchTile('a')).toEqual(new Uint8Array([1, 2]));
    expect(sleeps.filter((ms) => ms >= TILE_FETCH_POLICY.backoffMs)).toEqual([
      TILE_FETCH_POLICY.backoffMs,
      TILE_FETCH_POLICY.backoffMs * 2,
    ]);
    expect(await fetchTile('b')).toBeNull();
    await expect(fetchTile('c')).rejects.toThrow('tile fetch failed (400)');
  });

  it(`starts at most ${TILE_FETCH_POLICY.perSecond} requests per second and sends its user agent`, async () => {
    let clock = 0;
    const starts: number[] = [];
    const agents: string[] = [];
    const fetchTile = politeTileFetcher({
      fetch: async (_url, init) => {
        starts.push(clock);
        agents.push(init.headers['user-agent']!);
        return response(200);
      },
      userAgent: 'HuntClubMesh-MapPacks/1.0',
      sleep: async (ms) => void (clock += ms),
      now: () => clock,
    });
    for (let i = 0; i < 9; i++) await fetchTile(String(i));
    expect(starts[8]! - starts[0]!).toBeGreaterThanOrEqual(1000);
    expect(new Set(agents)).toEqual(new Set(['HuntClubMesh-MapPacks/1.0']));
  });
});
