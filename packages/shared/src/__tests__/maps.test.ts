import {
  BASEMAPS,
  DOWNLOAD_LIMITS,
  MAP_PACK_BUILD,
  MAP_PACK_LIMITS,
  TILE_FETCH_POLICY,
  type Bounds,
  countTiles,
  estimatePack,
  mapPackKey,
  polygonBounds,
  tileUrl,
  tilesInBounds,
} from '../maps';

const SMALL: Bounds = [-90.01, 39.99, -89.99, 40.01];

describe('shared map maths', () => {
  it('fills the USGS template with y before x', () => {
    expect(tileUrl('topo', 12, 1000, 1500)).toMatch(/\/tile\/12\/1500\/1000$/);
  });

  it('enumerates exactly the tiles it counts', () => {
    const tiles = [...tilesInBounds(SMALL, 10, 14)];
    expect(tiles).toHaveLength(countTiles(SMALL, 10, 14));
    expect(new Set(tiles.map((t) => `${t.z}/${t.x}/${t.y}`)).size).toBe(tiles.length);
  });

  it('estimates a pack against the shared caps', () => {
    const small = estimatePack(SMALL, DOWNLOAD_LIMITS.minZoom, DOWNLOAD_LIMITS.maxZoom, 'topo');
    expect(small.overLimit).toBeNull();
    expect(small.bytes).toBe(small.tiles * BASEMAPS.topo.averageTileBytes);
    const huge = estimatePack([-100, 30, -80, 45], 8, 15, 'aerial');
    expect(huge.overLimit).toBe('tiles');
  });

  it('bounds a polygon and keys packs under packs/<clubId>/', () => {
    expect(
      polygonBounds({
        coordinates: [
          [
            [-90, 40],
            [-89.99, 40],
            [-89.99, 40.01],
            [-90, 40],
          ],
        ],
      }),
    ).toEqual([-90, 40, -89.99, 40.01]);
    expect(mapPackKey('c1', 'p1')).toBe('packs/c1/p1.pmtiles');
  });

  it('caps club packs so a build at the polite rate fits the builder timeout', () => {
    const fetchSeconds = MAP_PACK_LIMITS.maxTiles / TILE_FETCH_POLICY.perSecond;
    expect(fetchSeconds + MAP_PACK_BUILD.marginSeconds).toBeLessThanOrEqual(
      MAP_PACK_BUILD.timeoutSeconds,
    );
    expect(MAP_PACK_LIMITS.maxTiles).toBeLessThanOrEqual(DOWNLOAD_LIMITS.maxTiles);
    // A pending build's lock outlives the Lambda that holds it.
    expect(MAP_PACK_BUILD.lockSeconds).toBeGreaterThan(MAP_PACK_BUILD.timeoutSeconds);
  });

  it('applies the caps it is given', () => {
    const bounds: Bounds = [-90.2, 39.8, -89.8, 40.2];
    const tiles = countTiles(bounds, 8, 13);
    expect(
      estimatePack(bounds, 8, 13, 'topo', { maxTiles: tiles, maxBytes: 1e12 }).overLimit,
    ).toBeNull();
    expect(
      estimatePack(bounds, 8, 13, 'topo', { maxTiles: tiles - 1, maxBytes: 1e12 }).overLimit,
    ).toBe('tiles');
  });
});
