import { BASEMAPS } from '../basemaps';
import {
  DETAIL_LEVELS,
  DOWNLOAD_LIMITS,
  countTiles,
  estimateDownload,
  tileXY,
  type Bounds,
} from '../tiles';

// About 1 km x 1 km in central Pennsylvania.
const SMALL: Bounds = [-77.866, 40.786, -77.854, 40.795];
// Most of a county.
const LARGE: Bounds = [-78.2, 40.6, -77.6, 41.0];

describe('tileXY', () => {
  it('matches the USGS tile fetched while confirming the service (z14 row 6250 col 4270)', () => {
    // Centre of tile 14/6250/4270.
    expect(tileXY(-86.1658, 39.1897, 14)).toEqual({ x: 4270, y: 6250 });
  });

  it('clamps to the tile grid', () => {
    expect(tileXY(-180, 89.9, 3)).toEqual({ x: 0, y: 0 });
    expect(tileXY(180, -89.9, 3)).toEqual({ x: 7, y: 7 });
  });
});

describe('countTiles', () => {
  it('counts one tile per zoom for a point-sized area', () => {
    const point: Bounds = [-77.86, 40.79, -77.86, 40.79];
    expect(countTiles(point, 8, 15)).toBe(8);
  });

  it('grows about four times per extra zoom level', () => {
    const at14 = countTiles(LARGE, 14, 14);
    const at15 = countTiles(LARGE, 15, 15);
    expect(at15 / at14).toBeGreaterThan(3.5);
    expect(at15 / at14).toBeLessThan(4.5);
  });

  it('never asks USGS for levels past its cache', () => {
    // Map zooms 15 and 17 both use tile level 16, the deepest cached level.
    expect(countTiles(SMALL, 17, 17)).toBe(countTiles(SMALL, 15, 15));
  });
});

describe('estimateDownload', () => {
  const full = DETAIL_LEVELS.find((level) => level.id === 'full')!;

  it('estimates bytes from the layer average tile size', () => {
    const estimate = estimateDownload(SMALL, full, 'topo');
    expect(estimate.tiles).toBe(countTiles(SMALL, full.minZoom, full.maxZoom));
    expect(estimate.bytes).toBe(estimate.tiles * BASEMAPS.topo.averageTileBytes);
    expect(estimate.overLimit).toBeNull();
  });

  it('refuses areas over the tile limit', () => {
    const estimate = estimateDownload(LARGE, full, 'aerial');
    expect(estimate.tiles).toBeGreaterThan(DOWNLOAD_LIMITS.maxTiles);
    expect(estimate.overLimit).toBe('tiles');
  });

  it('keeps every detail level within the USGS cache', () => {
    for (const level of DETAIL_LEVELS) {
      expect(level.maxZoom).toBeLessThanOrEqual(DOWNLOAD_LIMITS.maxZoom);
      expect(level.minZoom).toBeGreaterThanOrEqual(DOWNLOAD_LIMITS.minZoom);
    }
  });
});
