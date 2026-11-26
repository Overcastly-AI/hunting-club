import {
  BASEMAPS,
  DOWNLOAD_LIMITS,
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
});
