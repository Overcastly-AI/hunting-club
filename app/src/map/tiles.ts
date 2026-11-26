import { BASEMAPS, USGS_MAX_TILE_ZOOM, USGS_TILE_SIZE, type BasemapId } from './basemaps';

/** [west, south, east, north] in degrees, as MapLibre uses. */
export type Bounds = [west: number, south: number, east: number, north: number];

/** Web Mercator stops at this latitude. */
const MAX_MERCATOR_LAT = 85.05112878;
/** Map zoom is 512 px based; USGS tiles are 256 px, so tile zoom = map zoom + 1. */
const TILE_ZOOM_OFFSET = Math.log2(512 / USGS_TILE_SIZE);

/**
 * Offline download limits. USGS publishes no bulk-download policy for these
 * services, so we stay modest: a hunting property, not a state.
 * - Map zoom 15 reaches the deepest cached USGS level (16), about 2.4 m per pixel.
 *   Level 17+ returns 404 on both services (checked 2026-11-26), so a higher
 *   map zoom would only add failing requests; stand-level detail is level 16.
 * - At most 6,000 tiles and 150 MB per download (per layer).
 */
export const DOWNLOAD_LIMITS = {
  minZoom: 8,
  maxZoom: USGS_MAX_TILE_ZOOM - TILE_ZOOM_OFFSET,
  maxTiles: 6_000,
  maxBytes: 150 * 1024 * 1024,
} as const;

export type DetailLevel = { id: string; label: string; minZoom: number; maxZoom: number };

/** Zoom ranges offered when downloading, least to most detail. */
export const DETAIL_LEVELS: readonly DetailLevel[] = [
  { id: 'overview', label: 'Roads and creeks', minZoom: DOWNLOAD_LIMITS.minZoom, maxZoom: 12 },
  { id: 'standard', label: 'Trails and clearings', minZoom: DOWNLOAD_LIMITS.minZoom, maxZoom: 14 },
  {
    id: 'full',
    label: 'Most detail',
    minZoom: DOWNLOAD_LIMITS.minZoom,
    maxZoom: DOWNLOAD_LIMITS.maxZoom,
  },
];

function clampLat(lat: number): number {
  return Math.min(MAX_MERCATOR_LAT, Math.max(-MAX_MERCATOR_LAT, lat));
}

/** Slippy-map tile column and row containing a point at a tile zoom. */
export function tileXY(lon: number, lat: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const phi = (clampLat(lat) * Math.PI) / 180;
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * n);
  const clamp = (v: number) => Math.min(n - 1, Math.max(0, v));
  return { x: clamp(x), y: clamp(y) };
}

/** Number of USGS tiles an offline pack downloads for bounds and a map-zoom range. */
export function countTiles(bounds: Bounds, minZoom: number, maxZoom: number): number {
  const [west, south, east, north] = bounds;
  let total = 0;
  for (let mapZoom = minZoom; mapZoom <= maxZoom; mapZoom++) {
    const z = Math.min(USGS_MAX_TILE_ZOOM, mapZoom + TILE_ZOOM_OFFSET);
    const topLeft = tileXY(west, north, z);
    const bottomRight = tileXY(east, south, z);
    total += (bottomRight.x - topLeft.x + 1) * (bottomRight.y - topLeft.y + 1);
  }
  return total;
}

export type DownloadEstimate = {
  tiles: number;
  bytes: number;
  /** Why the download is refused, or null if it is within limits. */
  overLimit: 'tiles' | 'bytes' | null;
};

/** Size estimate for downloading one basemap layer. */
export function estimateDownload(
  bounds: Bounds,
  level: Pick<DetailLevel, 'minZoom' | 'maxZoom'>,
  basemap: BasemapId,
): DownloadEstimate {
  const tiles = countTiles(bounds, level.minZoom, level.maxZoom);
  const bytes = tiles * BASEMAPS[basemap].averageTileBytes;
  const overLimit =
    tiles > DOWNLOAD_LIMITS.maxTiles ? 'tiles' : bytes > DOWNLOAD_LIMITS.maxBytes ? 'bytes' : null;
  return { tiles, bytes, overLimit };
}

/** Size such as "12 MB" or "800 KB". */
export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 10) return `${Math.round(mb)} MB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
