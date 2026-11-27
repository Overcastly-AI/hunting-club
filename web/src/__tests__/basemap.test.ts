import { polygonBounds, rangeTileCount, tileRangeAt, type MapPack } from '@huntclub/shared';
import { parseHeader } from '@huntclub/pmtiles/reader';
import { basemapPack, basemapZoom, BASEMAP_MAX_TILES, loadBasemap } from '../map/basemap';
import { SAMPLE_PROPERTY } from '../map/sampleProperty';
import { sampleData } from '../testing/fakeClubApi';
import { memoryRead, nodeGunzip, packArchive, packFetch } from '../testing/packArchive';

const BOUNDS = polygonBounds(SAMPLE_PROPERTY.boundary);
const [topo] = sampleData().mapPacks as [Extract<MapPack, { status: 'ready' }>];
const ready = (n: number, source: string, builtAt: string): MapPack => ({
  ...topo,
  id: `${topo.id.slice(0, -2)}${String(n).padStart(2, '0')}`,
  source,
  builtAt,
});

describe('which pack My club draws', () => {
  it('the newest ready aerial, else the newest ready topo, else none', () => {
    const oldAerial = ready(3, 'usgs-imagery', '2026-11-01T00:00:00.000Z');
    const newAerial = ready(4, 'usgs-imagery', '2026-11-21T00:00:00.000Z');
    const newTopo = ready(5, 'usgs-topo', '2026-11-25T00:00:00.000Z');
    expect(basemapPack([newTopo, oldAerial, newAerial])?.id).toBe(newAerial.id);
    expect(basemapPack([topo, newTopo])?.id).toBe(newTopo.id);
    const failed = sampleData().mapPacks.filter((p) => p.status !== 'ready');
    expect(basemapPack(failed)).toBeUndefined();
    expect(basemapPack(undefined)).toBeUndefined();
    expect(basemapPack([ready(6, 'someone-else', '2026-11-26T00:00:00.000Z')])).toBeUndefined();
  });
});

describe('reading a pack', () => {
  it('reads the deepest level that stays within the tile cap', () => {
    const header = parseHeader(packArchive(BOUNDS, 16));
    expect(basemapZoom(header)).toBe(16);
    // A cap smaller than the property's tiles at 16 steps down, never below the archive's least.
    expect(basemapZoom(header, rangeTileCount(tileRangeAt(BOUNDS, 16)) - 1)).toBe(16);
    expect(basemapZoom({ ...header, minZoom: 12 }, 4)).toBeLessThan(16);
    expect(basemapZoom({ ...header, minZoom: 12 }, 0)).toBe(12);
  });

  it('turns every tile over the property into an image at its place on the ground', async () => {
    const archive = packArchive(BOUNDS, 16);
    const picture = await loadBasemap(topo as Extract<MapPack, { status: 'ready' }>, {
      read: memoryRead(archive),
      gunzip: nodeGunzip,
    });
    expect(picture.basemap.id).toBe('topo');
    const count = rangeTileCount(tileRangeAt(BOUNDS, 16));
    expect(count).toBeLessThanOrEqual(BASEMAP_MAX_TILES);
    expect(picture.tiles).toHaveLength(count);
    const first = picture.tiles[0]!;
    expect(first.href).toBe(`data:image/jpeg;base64,${btoa(`tile ${first.key}`)}`);
    const [west, south, east, north] = first.bounds;
    expect(west).toBeLessThanOrEqual(BOUNDS[0]);
    expect(north).toBeGreaterThanOrEqual(BOUNDS[3]);
    expect(east).toBeGreaterThan(west);
    expect(north).toBeGreaterThan(south);
  });

  it('reads the pack from its own origin only, by range', async () => {
    const pack = topo as Extract<MapPack, { status: 'ready' }>;
    const fetch = packFetch(pack, packArchive(BOUNDS, 16));
    vi.stubGlobal('fetch', fetch);
    try {
      await loadBasemap(pack, { gunzip: nodeGunzip });
    } finally {
      vi.unstubAllGlobals();
    }
    expect(fetch.mock.calls.length).toBeGreaterThan(1);
    for (const [url, init] of fetch.mock.calls) {
      expect(url).toBe(`/${pack.s3Key}`);
      expect(new Headers(init?.headers).get('range')).toMatch(/^bytes=\d+-\d+$/);
    }
  });
});
