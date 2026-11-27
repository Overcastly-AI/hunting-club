/**
 * A minimal PMTiles v3 writer (format.ts has the layout)
 * for raster map packs: tiles sorted by Hilbert tile id (clustered), gzip-compressed
 * directories and JSON metadata, tiles stored as-is (already JPEG/PNG), identical
 * tiles stored once. Small archives (a club's property) are built in memory.
 */
import { gzipSync } from 'node:zlib';
import {
  COMPRESSION,
  E7,
  type Entry,
  HEADER_BYTES,
  HEADER_FIELD as F,
  MAGIC,
  ROOT_SECTION_BYTES,
  type TileType,
  VERSION,
  zxyToTileId,
} from './format';

export { TILE_TYPE, type TileType, zxyToTileId } from './format';

/** The spec keeps the header plus root directory within the first 16 KiB. */
const ROOT_MAX_BYTES = ROOT_SECTION_BYTES - HEADER_BYTES;

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

const e7 = (deg: number) => Math.round(deg * E7);

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
  header.write(MAGIC, 0, 'ascii');
  header.writeUInt8(VERSION, F.version);
  const u64 = (value: number, at: number) => header.writeBigUInt64LE(BigInt(value), at);
  u64(rootOffset, F.rootOffset);
  u64(root.length, F.rootLength);
  u64(metadataOffset, F.metadataOffset);
  u64(metadata.length, F.metadataLength);
  u64(leavesOffset, F.leavesOffset);
  u64(leaves.length, F.leavesLength);
  u64(dataOffset, F.dataOffset);
  u64(data.length, F.dataLength);
  u64(sorted.length, F.addressedTiles);
  u64(entries.length, F.tileEntries);
  u64(contents.size, F.tileContents);
  header.writeUInt8(1, F.clustered);
  header.writeUInt8(COMPRESSION.gzip, F.internalCompression);
  header.writeUInt8(COMPRESSION.none, F.tileCompression); // tiles are JPEG/PNG already
  header.writeUInt8(options.tileType, F.tileType);
  header.writeUInt8(minZoom, F.minZoom);
  header.writeUInt8(maxZoom, F.maxZoom);
  header.writeInt32LE(e7(west), F.west);
  header.writeInt32LE(e7(south), F.south);
  header.writeInt32LE(e7(east), F.east);
  header.writeInt32LE(e7(north), F.north);
  header.writeUInt8(minZoom, F.centerZoom);
  header.writeInt32LE(e7((west + east) / 2), F.centerLon);
  header.writeInt32LE(e7((south + north) / 2), F.centerLat);

  return Buffer.concat([header, root, metadata, leaves, data]);
}
