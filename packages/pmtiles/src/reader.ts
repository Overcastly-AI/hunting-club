/**
 * A minimal PMTiles v3 reader (format.ts has the layout) for the archives writer.ts builds:
 * reads the header and root directory in one request, follows leaf directories, and returns
 * a tile's bytes. Runs anywhere with fetch and DecompressionStream (browsers, Node 18+): the
 * web admin draws a club's own map pack from its own origin with it. No dependency.
 */
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

export { TILE_TYPE, type TileType } from './format';

/** Reads `length` bytes at `offset` (fewer only at the end of the archive). */
export type RangeReader = (offset: number, length: number) => Promise<Uint8Array>;
/** Decompresses gzip. */
export type Gunzip = (bytes: Uint8Array) => Promise<Uint8Array>;

export interface PmtilesHeader {
  rootOffset: number;
  rootLength: number;
  metadataOffset: number;
  metadataLength: number;
  leavesOffset: number;
  leavesLength: number;
  dataOffset: number;
  dataLength: number;
  internalCompression: number;
  tileCompression: number;
  tileType: TileType;
  minZoom: number;
  maxZoom: number;
  /** [west, south, east, north] in degrees. */
  bounds: [number, number, number, number];
}

/** Not a PMTiles v3 archive this reader understands. */
export class PmtilesFormatError extends Error {}

export function parseHeader(bytes: Uint8Array): PmtilesHeader {
  if (bytes.length < HEADER_BYTES) throw new PmtilesFormatError('archive is too short');
  const magic = String.fromCharCode(...bytes.subarray(0, MAGIC.length));
  if (magic !== MAGIC) throw new PmtilesFormatError('not a PMTiles archive');
  if (bytes[F.version] !== VERSION) throw new PmtilesFormatError('not PMTiles version 3');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u64 = (at: number) => Number(view.getBigUint64(at, true));
  const deg = (at: number) => view.getInt32(at, true) / E7;
  return {
    rootOffset: u64(F.rootOffset),
    rootLength: u64(F.rootLength),
    metadataOffset: u64(F.metadataOffset),
    metadataLength: u64(F.metadataLength),
    leavesOffset: u64(F.leavesOffset),
    leavesLength: u64(F.leavesLength),
    dataOffset: u64(F.dataOffset),
    dataLength: u64(F.dataLength),
    internalCompression: view.getUint8(F.internalCompression),
    tileCompression: view.getUint8(F.tileCompression),
    tileType: view.getUint8(F.tileType) as TileType,
    minZoom: view.getUint8(F.minZoom),
    maxZoom: view.getUint8(F.maxZoom),
    bounds: [deg(F.west), deg(F.south), deg(F.east), deg(F.north)],
  };
}

/** Directory deserialization (spec §4): the inverse of the writer's serializeDirectory. */
export function parseDirectory(bytes: Uint8Array): Entry[] {
  let at = 0;
  const varint = () => {
    let value = 0;
    let scale = 1;
    for (;;) {
      const byte = bytes[at++];
      if (byte === undefined) throw new PmtilesFormatError('directory ends mid-number');
      value += (byte & 0x7f) * scale;
      if (byte < 0x80) return value;
      scale *= 0x80;
    }
  };
  const count = varint();
  const entries: Entry[] = Array.from({ length: count }, () => ({
    tileId: 0,
    offset: 0,
    length: 0,
    runLength: 0,
  }));
  let last = 0;
  for (const e of entries) e.tileId = last += varint();
  for (const e of entries) e.runLength = varint();
  for (const e of entries) e.length = varint();
  entries.forEach((e, i) => {
    const offset = varint();
    const prev = entries[i - 1];
    e.offset = offset === 0 && prev ? prev.offset + prev.length : offset - 1;
  });
  return entries;
}

/** The entry covering `tileId`: the last one starting at or before it. */
function findEntry(entries: readonly Entry[], tileId: number): Entry | undefined {
  let lo = 0;
  let hi = entries.length - 1;
  let found: Entry | undefined;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const entry = entries[mid]!;
    if (entry.tileId <= tileId) {
      found = entry;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/** gzip through the platform's DecompressionStream. */
export const streamGunzip: Gunzip = async (bytes) => {
  const body = new Response(bytes as Uint8Array<ArrayBuffer>).body!;
  return new Uint8Array(
    await new Response(body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(),
  );
};

/**
 * Ranges of a file over HTTP (the archive is served as is, e.g. by CloudFront from S3). A
 * server that ignores Range sends the whole file, which is sliced instead.
 */
export function fetchRangeReader(
  url: string,
  fetchBytes: typeof fetch = (input, init) => fetch(input, init),
): RangeReader {
  return async (offset, length) => {
    const response = await fetchBytes(url, {
      headers: { range: `bytes=${offset}-${offset + length - 1}` },
    });
    if (response.status !== 206 && response.status !== 200)
      throw new Error(`map pack request failed (${response.status})`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return response.status === 206 ? bytes : bytes.subarray(offset, offset + length);
  };
}

export interface PmtilesArchive {
  header: PmtilesHeader;
  /** The tile's bytes, or null when the archive has no tile there. */
  getTile(z: number, x: number, y: number): Promise<Uint8Array | null>;
}

/** Opens an archive: one read for the header and root directory, more only for leaves and tiles. */
export async function openPmtiles(
  read: RangeReader,
  options: { gunzip?: Gunzip } = {},
): Promise<PmtilesArchive> {
  const gunzip = options.gunzip ?? streamGunzip;
  const first = await read(0, ROOT_SECTION_BYTES);
  const header = parseHeader(first);
  if (
    header.internalCompression !== COMPRESSION.none &&
    header.internalCompression !== COMPRESSION.gzip
  )
    throw new PmtilesFormatError('unsupported directory compression');
  if (header.tileCompression !== COMPRESSION.none)
    throw new PmtilesFormatError('unsupported tile compression');
  const inflate = (bytes: Uint8Array) =>
    header.internalCompression === COMPRESSION.gzip ? gunzip(bytes) : Promise.resolve(bytes);
  const directory = async (bytes: Uint8Array) => parseDirectory(await inflate(bytes));

  const rootEnd = header.rootOffset + header.rootLength;
  const root = await directory(
    rootEnd <= first.length
      ? first.subarray(header.rootOffset, rootEnd)
      : await read(header.rootOffset, header.rootLength),
  );
  const leaves = new Map<number, Promise<Entry[]>>();
  const leaf = (entry: Entry) => {
    let cached = leaves.get(entry.offset);
    if (!cached) {
      cached = read(header.leavesOffset + entry.offset, entry.length).then(directory);
      leaves.set(entry.offset, cached);
    }
    return cached;
  };

  return {
    header,
    async getTile(z, x, y) {
      const tileId = zxyToTileId(z, x, y);
      let entries = root;
      // The writer nests one level of leaves; the spec allows more.
      for (let depth = 0; depth < 4; depth++) {
        const entry = findEntry(entries, tileId);
        if (!entry) return null;
        if (entry.runLength > 0) {
          if (tileId >= entry.tileId + entry.runLength) return null;
          return read(header.dataOffset + entry.offset, entry.length);
        }
        entries = await leaf(entry);
      }
      throw new PmtilesFormatError('directories nest too deep');
    },
  };
}
