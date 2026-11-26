/**
 * A minimal PMTiles v3 writer (https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md)
 * for raster map packs: tiles sorted by Hilbert tile id (clustered), gzip-compressed
 * directories and JSON metadata, tiles stored as-is (already JPEG/PNG), identical
 * tiles stored once. Small archives (a club's property) are built in memory.
 */
import { gzipSync } from 'node:zlib';

/** PMTiles tile types (spec §3.1). */
export const TILE_TYPE = { unknown: 0, mvt: 1, png: 2, jpeg: 3, webp: 4, avif: 5 } as const;
export type TileType = (typeof TILE_TYPE)[keyof typeof TILE_TYPE];

const COMPRESSION = { none: 1, gzip: 2 } as const;
const HEADER_BYTES = 127;
/** The spec keeps the header plus root directory within the first 16 KiB. */
const ROOT_MAX_BYTES = 16_384 - HEADER_BYTES;

export interface Tile {
  z: number;
  x: number;
  y: number;
  data: Uint8Array;
}

export interface ArchiveOptions {
  tileType: TileType;
  /** [west, south, east, north] in degrees. */
  bounds: readonly [number, number, number, number];
  /** Free-form JSON metadata (attribution, name, …). */
  metadata?: Record<string, unknown>;
}

interface Entry {
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

class Bytes {
  private readonly parts: number[] = [];
  varint(value: number) {
    let v = value;
    while (v >= 0x80) {
      this.parts.push((v % 0x80) | 0x80);
      v = Math.floor(v / 0x80);
    }
    this.parts.push(v);
  }
  toBuffer() {
    return Buffer.from(this.parts);
  }
}

/** Directory serialization (spec §4): columns of varints, then gzip. */
function serializeDirectory(entries: readonly Entry[]): Buffer {
  const b = new Bytes();
  b.varint(entries.length);
  let last = 0;
  for (const e of entries) {
    b.varint(e.tileId - last);
    last = e.tileId;
  }
  for (const e of entries) b.varint(e.runLength);
  for (const e of entries) b.varint(e.length);
  entries.forEach((e, i) => {
    const prev = entries[i - 1];
    b.varint(i > 0 && prev && e.offset === prev.offset + prev.length ? 0 : e.offset + 1);
  });
  return gzipSync(b.toBuffer());
}

/** Root directory, plus leaf directories when the root alone would not fit (spec §4.1). */
function buildDirectories(entries: Entry[]): { root: Buffer; leaves: Buffer } {
  const root = serializeDirectory(entries);
  if (root.length <= ROOT_MAX_BYTES) return { root, leaves: Buffer.alloc(0) };
  for (let leafSize = 4096; ; leafSize *= 2) {
    const leafParts: Buffer[] = [];
    const rootEntries: Entry[] = [];
    let offset = 0;
    for (let i = 0; i < entries.length; i += leafSize) {
      const chunk = entries.slice(i, i + leafSize);
      const leaf = serializeDirectory(chunk);
      rootEntries.push({ tileId: chunk[0]!.tileId, offset, length: leaf.length, runLength: 0 });
      leafParts.push(leaf);
      offset += leaf.length;
    }
    const candidate = serializeDirectory(rootEntries);
    if (candidate.length <= ROOT_MAX_BYTES)
      return { root: candidate, leaves: Buffer.concat(leafParts) };
  }
}

const e7 = (deg: number) => Math.round(deg * 1e7);

/** Builds a complete .pmtiles archive. Throws on duplicate or out-of-range tiles. */
export function writePmtiles(tiles: Iterable<Tile>, options: ArchiveOptions): Buffer {
  const sorted = [...tiles]
    .map((t) => ({ ...t, tileId: zxyToTileId(t.z, t.x, t.y) }))
    .sort((a, b) => a.tileId - b.tileId);
  if (sorted.length === 0) throw new Error('a map pack needs at least one tile');

  // Tile data, each distinct content once; consecutive identical tiles become runs.
  const contents = new Map<string, { offset: number; length: number }>();
  const dataParts: Buffer[] = [];
  let dataLength = 0;
  const entries: Entry[] = [];
  for (const t of sorted) {
    const prev = entries[entries.length - 1];
    if (prev && prev.tileId === t.tileId) throw new Error(`duplicate tile ${t.z}/${t.x}/${t.y}`);
    const key = Buffer.from(t.data).toString('base64');
    let stored = contents.get(key);
    if (!stored) {
      stored = { offset: dataLength, length: t.data.length };
      contents.set(key, stored);
      dataParts.push(Buffer.from(t.data));
      dataLength += t.data.length;
    }
    if (prev && prev.offset === stored.offset && prev.tileId + prev.runLength === t.tileId) {
      prev.runLength += 1;
    } else {
      entries.push({
        tileId: t.tileId,
        offset: stored.offset,
        length: stored.length,
        runLength: 1,
      });
    }
  }

  const { root, leaves } = buildDirectories(entries);
  const metadata = gzipSync(Buffer.from(JSON.stringify(options.metadata ?? {})));
  const data = Buffer.concat(dataParts);
  const zooms = sorted.map((t) => t.z);
  const minZoom = Math.min(...zooms);
  const maxZoom = Math.max(...zooms);
  const [west, south, east, north] = options.bounds;

  const rootOffset = HEADER_BYTES;
  const metadataOffset = rootOffset + root.length;
  const leavesOffset = metadataOffset + metadata.length;
  const dataOffset = leavesOffset + leaves.length;

  const header = Buffer.alloc(HEADER_BYTES);
  header.write('PMTiles', 0, 'ascii');
  header.writeUInt8(3, 7);
  const u64 = (value: number, at: number) => header.writeBigUInt64LE(BigInt(value), at);
  u64(rootOffset, 8);
  u64(root.length, 16);
  u64(metadataOffset, 24);
  u64(metadata.length, 32);
  u64(leavesOffset, 40);
  u64(leaves.length, 48);
  u64(dataOffset, 56);
  u64(data.length, 64);
  u64(sorted.length, 72); // addressed tiles
  u64(entries.length, 80); // tile entries
  u64(contents.size, 88); // tile contents
  header.writeUInt8(1, 96); // clustered
  header.writeUInt8(COMPRESSION.gzip, 97); // internal compression
  header.writeUInt8(COMPRESSION.none, 98); // tiles are JPEG/PNG already
  header.writeUInt8(options.tileType, 99);
  header.writeUInt8(minZoom, 100);
  header.writeUInt8(maxZoom, 101);
  header.writeInt32LE(e7(west), 102);
  header.writeInt32LE(e7(south), 106);
  header.writeInt32LE(e7(east), 110);
  header.writeInt32LE(e7(north), 114);
  header.writeUInt8(minZoom, 118); // center zoom
  header.writeInt32LE(e7((west + east) / 2), 119);
  header.writeInt32LE(e7((south + north) / 2), 123);

  return Buffer.concat([header, root, metadata, leaves, data]);
}
