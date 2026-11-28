// USGS basemaps and slippy-map tile maths: the single source for the app's live map
// and downloads, and for the club map-pack builder Lambda.

import { WEB_DOMAINS } from './app';

/**
 * Free basemaps from USGS The National Map (public domain), confirmed
 * 2026-11-26 against each service's `?f=json`:
 * - Cached Web Mercator (wkid 3857) services, 256 px JPEG tiles, `/tile/{z}/{y}/{x}`.
 * - The cache's coarsest scale (maxScale 9027.98) is tile level 16; deeper
 *   levels are not cached (404), so we cap there and let the map overzoom.
 * - USGSImageryTopo no longer exists (404), so aerial is USGSImageryOnly.
 */
const USGS_BASEMAP_ROOT = 'https://basemap.nationalmap.gov/arcgis/rest/services';

/**
 * The one host every USGS tile comes from. The web admin shows live tiles as images, so its
 * Content-Security-Policy allows exactly this origin in img-src (infra/src/security-headers.ts).
 */
export const USGS_BASEMAP_ORIGIN = new URL(USGS_BASEMAP_ROOT).origin;

/** Deepest cached USGS tile level. */
export const USGS_MAX_TILE_ZOOM = 16;
/** USGS tiles are 256 px. MapLibre zoom is 512 px based, so map zoom = tile zoom - 1. */
export const USGS_TILE_SIZE = 256;
/** Tile zoom = map zoom + this. */
export const TILE_ZOOM_OFFSET = Math.log2(512 / USGS_TILE_SIZE);

export type BasemapId = 'topo' | 'aerial';

export type Basemap = {
  id: BasemapId;
  /** Word label in the layer switcher. */
  label: string;
  /** Stored as a map pack's `source`. */
  source: string;
  /** `{z}/{y}/{x}` template (ArcGIS order: row before column). */
  tileUrl: string;
  /** Short credit always visible on the map. */
  credit: string;
  /** The service's own copyrightText, shown in full from the layers panel. */
  attribution: string;
  /**
   * Average bytes per tile used for download size estimates. Measured tiles
   * were 21–29 KB; these round up so estimates err high (forest imagery is larger).
   */
  averageTileBytes: number;
};

const usgsTiles = (service: string) => `${USGS_BASEMAP_ROOT}/${service}/MapServer/tile/{z}/{y}/{x}`;

export const BASEMAPS: Record<BasemapId, Basemap> = {
  topo: {
    id: 'topo',
    label: 'Topo',
    source: 'usgs-topo',
    tileUrl: usgsTiles('USGSTopo'),
    credit: 'USGS The National Map',
    attribution:
      'USGS The National Map: National Boundaries Dataset, 3DEP Elevation Program, Geographic Names Information System, National Hydrography Dataset, National Land Cover Database, National Structures Dataset, and National Transportation Dataset; USGS Global Ecosystems; U.S. Census Bureau TIGER/Line data; USFS Road data; Natural Earth Data; U.S. Department of State HIU; NOAA National Centers for Environmental Information.',
    averageTileBytes: 32_000,
  },
  aerial: {
    id: 'aerial',
    label: 'Aerial',
    source: 'usgs-imagery',
    tileUrl: usgsTiles('USGSImageryOnly'),
    credit: 'USDA, USGS The National Map',
    attribution: 'USDA, USGS The National Map: Orthoimagery.',
    averageTileBytes: 40_000,
  },
};

export const BASEMAP_IDS = Object.keys(BASEMAPS) as BasemapId[];

export function basemapBySource(source: string): Basemap | undefined {
  return Object.values(BASEMAPS).find((basemap) => basemap.source === source);
}

/** The URL of one tile (tile zoom, column, row). */
export function tileUrl(basemap: BasemapId, z: number, x: number, y: number): string {
  return BASEMAPS[basemap].tileUrl
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}

/** [west, south, east, north] in degrees, as MapLibre uses. */
export type Bounds = [west: number, south: number, east: number, north: number];

/** Web Mercator stops at this latitude. */
const MAX_MERCATOR_LAT = 85.05112878;

function clampLat(lat: number): number {
  return Math.min(MAX_MERCATOR_LAT, Math.max(-MAX_MERCATOR_LAT, lat));
}

/** The Earth's circumference at the equator in Web Mercator, in metres. */
export const EARTH_CIRCUMFERENCE_METRES = 2 * Math.PI * 6_378_137;

/**
 * A point in Web Mercator world units: x from 0 (180° W) to 1 (180° E), y from 0 (the north
 * edge of the map) to 1 (the south edge). One tile at zoom z is 1 / 2^z of the world.
 */
export function mercatorXY(lon: number, lat: number): [x: number, y: number] {
  const phi = (clampLat(lat) * Math.PI) / 180;
  return [(lon + 180) / 360, (1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2];
}

/** The [lon, lat] of a point in Web Mercator world units (the inverse of mercatorXY). */
export function mercatorLonLat(x: number, y: number): [lon: number, lat: number] {
  return [x * 360 - 180, (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI];
}

/** Slippy-map tile column and row containing a point at a tile zoom. */
export function tileXY(lon: number, lat: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const [wx, wy] = mercatorXY(lon, lat);
  const clamp = (v: number) => Math.min(n - 1, Math.max(0, v));
  return { x: clamp(Math.floor(wx * n)), y: clamp(Math.floor(wy * n)) };
}

/** Tile columns and rows covering bounds at one TILE zoom. */
export type TileRange = { z: number; minX: number; maxX: number; minY: number; maxY: number };

/** The tiles covering bounds at one tile zoom. */
export function tileRangeAt(bounds: Readonly<Bounds>, z: number): TileRange {
  const [west, south, east, north] = bounds;
  const topLeft = tileXY(west, north, z);
  const bottomRight = tileXY(east, south, z);
  return { z, minX: topLeft.x, maxX: bottomRight.x, minY: topLeft.y, maxY: bottomRight.y };
}

/** Number of tiles in a range. */
export const rangeTileCount = (r: TileRange) => (r.maxX - r.minX + 1) * (r.maxY - r.minY + 1);

/** The [west, south, east, north] a tile covers (the inverse of tileXY). */
export function tileBounds(z: number, x: number, y: number): Bounds {
  const n = 2 ** z;
  const [west, north] = mercatorLonLat(x / n, y / n);
  const [east, south] = mercatorLonLat((x + 1) / n, (y + 1) / n);
  return [west, south, east, north];
}

/** The USGS tile ranges (per tile zoom) covering bounds over a MAP-zoom range. */
export function tileRanges(
  bounds: Readonly<Bounds>,
  minZoom: number,
  maxZoom: number,
): TileRange[] {
  const ranges = new Map<number, TileRange>();
  for (let mapZoom = minZoom; mapZoom <= maxZoom; mapZoom++) {
    const z = Math.min(USGS_MAX_TILE_ZOOM, mapZoom + TILE_ZOOM_OFFSET);
    ranges.set(z, tileRangeAt(bounds, z));
  }
  return [...ranges.values()];
}

/** Number of USGS tiles covering bounds over a map-zoom range. */
export function countTiles(bounds: Readonly<Bounds>, minZoom: number, maxZoom: number): number {
  return tileRanges(bounds, minZoom, maxZoom).reduce((sum, r) => sum + rangeTileCount(r), 0);
}

/** Every tile (tile zoom, column, row) covering bounds over a map-zoom range. */
export function* tilesInBounds(
  bounds: Readonly<Bounds>,
  minZoom: number,
  maxZoom: number,
): Generator<{ z: number; x: number; y: number }> {
  for (const r of tileRanges(bounds, minZoom, maxZoom))
    for (let x = r.minX; x <= r.maxX; x++)
      for (let y = r.minY; y <= r.maxY; y++) yield { z: r.z, x, y };
}

/**
 * Download limits for one basemap layer (phone downloads and club packs alike).
 * USGS publishes no bulk-download policy, so we stay modest: a hunting property,
 * not a state. Map zoom 15 reaches the deepest cached USGS level (16).
 */
export const DOWNLOAD_LIMITS = {
  minZoom: 8,
  maxZoom: USGS_MAX_TILE_ZOOM - TILE_ZOOM_OFFSET,
  maxTiles: 6_000,
  maxBytes: 150 * 1024 * 1024,
} as const;

/** S3 key prefix (and CloudFront path) of club map packs. Never pruned by web deploys. */
export const MAP_PACKS_PREFIX = 'packs/';

/**
 * How a map pack archive is stored: its media type, and cached for a year (every pack has its
 * own id, so an archive never changes under its key). The builder Lambda and the sample pack's
 * deploy both write packs this way.
 */
export const MAP_PACK_OBJECT = {
  contentType: 'application/vnd.pmtiles',
  cacheControl: 'public, max-age=31536000, immutable',
} as const;

/** Where a club's map pack archive lives: `packs/<clubId>/<packId>.pmtiles`. */
export function mapPackKey(clubId: string, packId: string): string {
  return `${MAP_PACKS_PREFIX}${clubId}/${packId}.pmtiles`;
}

/**
 * A ready club map pack's path on the environment's web domain (CloudFront serves the
 * bucket at its S3 key). The web admin reads it from its own origin with this.
 */
export function mapPackPath(pack: { s3Key: string }): string {
  return `/${pack.s3Key}`;
}

/** Where a phone downloads a ready club map pack: the web domain plus mapPackPath. */
export function mapPackUrl(env: keyof typeof WEB_DOMAINS, pack: { s3Key: string }): string {
  return `https://${WEB_DOMAINS[env]}${mapPackPath(pack)}`;
}

/** A ring of [lon, lat] points. */
export type Ring = [lon: number, lat: number][];

/**
 * Every ring of a GeoJSON Polygon or MultiPolygon (outer rings and holes), as [lon, lat]
 * points; anything that is not a position is skipped, so a malformed polygon gives fewer
 * rings, never a crash.
 */
export function polygonRings(polygon: { coordinates: unknown }): Ring[] {
  const rings: Ring[] = [];
  const isPosition = (value: unknown): value is [number, number] =>
    Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number';
  const walk = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (value.length > 0 && value.every(isPosition)) {
      rings.push(value.map(([lon, lat]) => [lon, lat]));
    } else value.forEach(walk);
  };
  walk(polygon.coordinates);
  return rings;
}

/**
 * Where a polygon's name goes: the middle of its north edge (the map sets it just inside, by
 * `mapChrome.labels.area.drop`), so stands, usually inside an area, rarely sit on it.
 */
export function ringsLabelPoint(rings: readonly Ring[]): [lon: number, lat: number] | null {
  const points = rings[0];
  if (!points || points.length === 0) return null;
  const lons = points.map((p) => p[0]);
  const north = Math.max(...points.map((p) => p[1]));
  return [(Math.min(...lons) + Math.max(...lons)) / 2, north];
}

/** Bounding box of a GeoJSON Polygon or MultiPolygon (a club's property line). */
export function polygonBounds(polygon: { coordinates: unknown }): Bounds {
  const points = polygonRings(polygon).flat();
  if (points.length === 0) throw new Error('polygon has no coordinates');
  const lons = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

/** How politely the map-pack builder fetches USGS tiles (no published bulk policy). */
export const TILE_FETCH_POLICY = {
  /** Requests in flight at once. */
  concurrency: 4,
  /** At most this many requests start per second. */
  perSecond: 8,
  /** Retries for 429, 5xx and network errors, with doubling backoff. */
  retries: 3,
  backoffMs: 500,
} as const;

/** Lambda's maximum run time; the builder uses all of it. */
const BUILD_TIMEOUT_SECONDS = 900;

/** The map-pack builder Lambda's time budget. */
export const MAP_PACK_BUILD = {
  timeoutSeconds: BUILD_TIMEOUT_SECONDS,
  /**
   * Left over after fetching at the full rate: USGS latency, retries and backoff,
   * writing the archive and uploading it. A build that would not fit is refused.
   */
  marginSeconds: 300,
  /** A pending build blocks the next one for this long, even if its Lambda died. */
  lockSeconds: BUILD_TIMEOUT_SECONDS + 60,
} as const;

/**
 * Caps for a club map pack: the phone-download caps, with the tile count derived from
 * the fetch rate and the builder's time budget so every accepted pack can finish.
 */
export const MAP_PACK_LIMITS = {
  ...DOWNLOAD_LIMITS,
  maxTiles: Math.min(
    DOWNLOAD_LIMITS.maxTiles,
    TILE_FETCH_POLICY.perSecond * (MAP_PACK_BUILD.timeoutSeconds - MAP_PACK_BUILD.marginSeconds),
  ),
} as const;

export type DownloadLimits = { readonly maxTiles: number; readonly maxBytes: number };

/** Size check for one basemap layer over bounds and a map-zoom range. */
export function estimatePack(
  bounds: Readonly<Bounds>,
  minZoom: number,
  maxZoom: number,
  basemap: BasemapId,
  limits: DownloadLimits = DOWNLOAD_LIMITS,
): { tiles: number; bytes: number; overLimit: 'tiles' | 'bytes' | null } {
  const tiles = countTiles(bounds, minZoom, maxZoom);
  const bytes = tiles * BASEMAPS[basemap].averageTileBytes;
  const overLimit = tiles > limits.maxTiles ? 'tiles' : bytes > limits.maxBytes ? 'bytes' : null;
  return { tiles, bytes, overLimit };
}

/**
 * The size check for a club map pack of a property line, with MAP_PACK_LIMITS: one rule
 * for the API (which refuses over-limit packs) and the web admin (which says so first).
 */
export function estimateClubPack(
  boundary: { coordinates: unknown },
  request: { basemap: BasemapId; minZoom?: number; maxZoom?: number },
): ReturnType<typeof estimatePack> & { bounds: Bounds } {
  const bounds = polygonBounds(boundary);
  const minZoom = request.minZoom ?? MAP_PACK_LIMITS.minZoom;
  const maxZoom = request.maxZoom ?? MAP_PACK_LIMITS.maxZoom;
  return { bounds, ...estimatePack(bounds, minZoom, maxZoom, request.basemap, MAP_PACK_LIMITS) };
}

/** Size such as "12 MB" or "800 KB" (downloads and map packs, app and web admin). */
export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 10) return `${Math.round(mb)} MB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
