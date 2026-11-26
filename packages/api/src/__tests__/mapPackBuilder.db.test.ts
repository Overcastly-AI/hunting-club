// The map-pack builder end to end: fake USGS tiles → PMTiles archive → "S3" → the
// club's map_pack item on DynamoDB Local. No network.
import { SERVICE } from '@huntclub/club-data';
import { World } from '@huntclub/club-data/testing';
import {
  type Bounds,
  MAP_PACKS_PREFIX,
  MAP_PACK_BUILD,
  type MapPackBuild,
  TILE_FETCH_POLICY,
  countTiles,
} from '@huntclub/shared';
import { type MapPackBuilderDeps, buildMapPack, politeTileFetcher } from '../mapPackBuilder';

const BOUNDS: Bounds = [-90.01, 40.0, -89.99, 40.02];
let w: World;
const oak = () => w.club('Oak Ridge');

/** Starts a pack as the API does (admin, building + lock) and returns its build job. */
async function startBuild(job: Omit<MapPackBuild, 'clubId' | 'packId'>): Promise<MapPackBuild> {
  const { bounds, minZoom, maxZoom } = job;
  const pack = await w.data.startMapPackBuild(w.as('ada'), oak(), {
    bounds,
    minZoom,
    maxZoom,
    source: 'usgs',
  });
  return { ...job, clubId: oak(), packId: pack.id };
}
const deps = (over: Partial<MapPackBuilderDeps> = {}): MapPackBuilderDeps => ({
  data: w.data,
  fetchTile: async () => Buffer.from('jpeg'),
  putObject: async () => undefined,
  ...over,
});
const packStatus = async (id: string) =>
  (await w.data.listMapPacks(SERVICE, oak())).find((p) => p.id === id);

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

it('fetches every tile of the property, writes a PMTiles archive and marks the pack ready', async () => {
  const urls: string[] = [];
  const stored = new Map<string, Buffer>();
  const job = await startBuild({ basemap: 'topo', bounds: BOUNDS, minZoom: 12, maxZoom: 13 });
  const pack = await buildMapPack(
    job,
    deps({
      fetchTile: async (url) => {
        urls.push(url);
        return url.endsWith('/0/0') ? null : Buffer.from(`jpeg ${url}`);
      },
      putObject: async (key, body) => void stored.set(key, body),
    }),
  );
  expect(urls).toHaveLength(countTiles(BOUNDS, 12, 13));
  expect(urls[0]).toMatch(
    /^https:\/\/basemap\.nationalmap\.gov\/.+\/USGSTopo\/MapServer\/tile\/13\/\d+\/\d+$/,
  );
  const key = `${MAP_PACKS_PREFIX}${oak()}/${job.packId}.pmtiles`;
  const archive = stored.get(key)!;
  expect(header(archive)).toEqual({
    magic: 'PMTiles',
    version: 3,
    addressedTiles: urls.length,
    tileType: 3,
  });
  expect(pack).toMatchObject({
    id: job.packId,
    status: 'ready',
    s3Key: key,
    sizeBytes: archive.length,
    minZoom: 12,
    maxZoom: 13,
  });
  expect(await w.data.listMapPacks(w.as('max'), oak())).toEqual([pack]);
});

it('refuses a build over the club pack caps without fetching, and records why', async () => {
  const fetchTile = jest.fn();
  const job = await startBuild({
    basemap: 'aerial',
    bounds: [-91, 39, -89, 41],
    minZoom: 8,
    maxZoom: 15,
  });
  await expect(buildMapPack(job, deps({ fetchTile }))).rejects.toThrow(
    'too big for one pack (tiles)',
  );
  expect(fetchTile).not.toHaveBeenCalled();
  expect(await packStatus(job.packId)).toMatchObject({
    status: 'failed',
    reason: 'the property is too big for one pack (tiles)',
  });
});

it('records a USGS outage as the reason, and frees the club for the next build', async () => {
  const job = await startBuild({ basemap: 'topo', bounds: BOUNDS, minZoom: 12, maxZoom: 12 });
  const outage = politeTileFetcher({
    fetch: async () => ({ status: 503, arrayBuffer: async () => new ArrayBuffer(0) }),
    userAgent: 'test',
    sleep: async () => undefined,
  });
  await expect(buildMapPack(job, deps({ fetchTile: outage }))).rejects.toThrow();
  expect(await packStatus(job.packId)).toMatchObject({
    status: 'failed',
    reason: 'USGS tiles could not be fetched (503)',
  });
  await expect(
    startBuild({ basemap: 'topo', bounds: BOUNDS, minZoom: 12, maxZoom: 12 }),
  ).resolves.toBeDefined();
});

it('never shows admins the details of an unexpected error', async () => {
  // The previous test left a build pending; time it out so a new one can start.
  w.clock.advance(MAP_PACK_BUILD.lockSeconds * 1000 + 1000);
  const job = await startBuild({ basemap: 'topo', bounds: BOUNDS, minZoom: 12, maxZoom: 12 });
  const putObject = async () => {
    throw new Error('AccessDenied arn:aws:s3:::secret-bucket');
  };
  await expect(buildMapPack(job, deps({ putObject }))).rejects.toThrow('AccessDenied');
  const failed = await packStatus(job.packId);
  expect(failed).toMatchObject({ status: 'failed' });
  expect(JSON.stringify(failed)).not.toMatch(/AccessDenied|arn:/);
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
    await expect(fetchTile('c')).rejects.toThrow('USGS tiles could not be fetched (400)');
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
