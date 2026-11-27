// Map pack archives for the tests: the real writer (@huntclub/pmtiles, Node) over stand-in
// tile bytes, served the way CloudFront serves a pack (range requests at its path).
import { gunzipSync } from 'node:zlib';
import { TILE_TYPE, writePmtiles } from '@huntclub/pmtiles';
import { mapPackPath, tileRangeAt, type Bounds, type MapPack } from '@huntclub/shared';

/** A pack over `bounds` at one tile zoom, each tile's bytes naming the tile. */
export function packArchive(bounds: Bounds, z = 16): Buffer {
  const range = tileRangeAt(bounds, z);
  const tiles = [];
  for (let x = range.minX; x <= range.maxX; x++)
    for (let y = range.minY; y <= range.maxY; y++)
      tiles.push({ z, x, y, data: Buffer.from(`tile ${z}/${x}/${y}`) });
  return writePmtiles(tiles, { tileType: TILE_TYPE.jpeg, bounds });
}

/** Range reads over an archive in memory. */
export const memoryRead = (archive: Buffer) => async (offset: number, length: number) =>
  new Uint8Array(archive.subarray(offset, offset + length));

export const nodeGunzip = async (bytes: Uint8Array) => new Uint8Array(gunzipSync(bytes));

/** A fetch that serves `archive` at the pack's path (206 for a range) and 404 elsewhere. */
export function packFetch(pack: Pick<MapPack, 's3Key'>, archive: Buffer) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    if (String(input) !== mapPackPath(pack)) return new Response(null, { status: 404 });
    const range = new Headers(init?.headers).get('range');
    const [, from, to] = /bytes=(\d+)-(\d+)/.exec(range ?? '')?.map(Number) ?? [];
    if (from === undefined || to === undefined) return new Response(new Uint8Array(archive));
    return new Response(new Uint8Array(archive.subarray(from, to + 1)), { status: 206 });
  });
}
