/**
 * The PMTiles v3 layout (https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md): the
 * one source for the writer (Node, the map-pack builder) and the reader (any runtime with
 * fetch, the web admin). No Node or DOM APIs here.
 */

/** PMTiles tile types (spec §3.1). */
export const TILE_TYPE = { unknown: 0, mvt: 1, png: 2, jpeg: 3, webp: 4, avif: 5 } as const;
export type TileType = (typeof TILE_TYPE)[keyof typeof TILE_TYPE];

/** Compression of directories, metadata or tiles (spec §3.2). */
export const COMPRESSION = { unknown: 0, none: 1, gzip: 2 } as const;

export const HEADER_BYTES = 127;
/** The spec keeps the header plus root directory within the first 16 KiB. */
export const ROOT_SECTION_BYTES = 16_384;

/** Byte offsets of the header's fields (spec §3). */
export const HEADER_FIELD = {
  version: 7,
  rootOffset: 8,
  rootLength: 16,
  metadataOffset: 24,
  metadataLength: 32,
  leavesOffset: 40,
  leavesLength: 48,
  dataOffset: 56,
  dataLength: 64,
  addressedTiles: 72,
  tileEntries: 80,
  tileContents: 88,
  clustered: 96,
  internalCompression: 97,
  tileCompression: 98,
  tileType: 99,
  minZoom: 100,
  maxZoom: 101,
  west: 102,
  south: 106,
  east: 110,
  north: 114,
  centerZoom: 118,
  centerLon: 119,
  centerLat: 123,
} as const;

export const MAGIC = 'PMTiles';
export const VERSION = 3;

/** Degrees are stored as integers of 1e-7 degrees. */
export const E7 = 1e7;

/** One directory entry (spec §4): a run of tiles, or (runLength 0) a leaf directory. */
export interface Entry {
  tileId: number;
  offset: number;
  length: number;
  runLength: number;
}

/** Hilbert tile id of z/x/y (spec §2.1): tiles of all lower zooms come first. */
export function zxyToTileId(z: number, x: number, y: number): number {
  if (z > 26) throw new RangeError('zoom above 26 is not supported');
  const n = 2 ** z;
  if (x < 0 || y < 0 || x >= n || y >= n)
    throw new RangeError(`tile ${z}/${x}/${y} is out of range`);
  let id = (4 ** z - 1) / 3;
  let tx = x;
  let ty = y;
  for (let s = n / 2; s >= 1; s /= 2) {
    const rx = tx & s ? 1 : 0;
    const ry = ty & s ? 1 : 0;
    id += s * s * ((3 * rx) ^ ry);
    // Rotate the quadrant so the curve stays continuous.
    if (ry === 0) {
      if (rx === 1) {
        tx = s - 1 - tx;
        ty = s - 1 - ty;
      }
      [tx, ty] = [ty, tx];
    }
  }
  return id;
}
