// Archives written here are read back with the reference reader (`pmtiles`, test-only).
import { gunzipSync } from 'node:zlib';
import { PMTiles, type Source, zxyToTileId as referenceTileId } from 'pmtiles';
import { TILE_TYPE, writePmtiles, zxyToTileId, type Tile } from '../writer';

const BOUNDS = [-90.01, 39.99, -89.98, 40.02] as const;

/** A standalone ArrayBuffer with exactly these bytes (Node Buffers share a pool). */
const exactBuffer = (bytes: Uint8Array): ArrayBuffer => Uint8Array.from(bytes).buffer;

function bufferSource(buf: Buffer): Source {
  return {
    getKey: () => 'memory',
    getBytes: async (offset, length) => ({
      data: exactBuffer(buf.subarray(offset, offset + length)),
    }),
  };
}
const reader = (buf: Buffer) =>
  new PMTiles(bufferSource(buf), undefined, async (data, compression) =>
    compression === 2 ? exactBuffer(gunzipSync(Buffer.from(data))) : data,
  );

/** Every tile covering a small square at zooms min..max, each with unique bytes. */
function tilesAround(minZoom: number, maxZoom: number, size = 3): Tile[] {
  const tiles: Tile[] = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const cx = Math.floor(2 ** z * 0.25);
    for (let x = cx; x < cx + size; x++)
      for (let y = cx; y < cx + size; y++)
        tiles.push({ z, x, y, data: Buffer.from(`jpeg ${z}/${x}/${y}`) });
  }
  return tiles;
}

it('numbers tiles exactly like the reference implementation', () => {
  for (let z = 0; z <= 12; z++) {
    const n = 2 ** z;
    for (const [x, y] of [
      [0, 0],
      [n - 1, 0],
      [0, n - 1],
      [n - 1, n - 1],
      [Math.floor(n / 3), Math.floor(n / 5)],
    ]) {
      expect(zxyToTileId(z, x!, y!)).toBe(referenceTileId(z, x!, y!));
    }
  }
  expect(zxyToTileId(16, 16_000, 24_000)).toBe(referenceTileId(16, 16_000, 24_000));
});

it('writes an archive the reference reader opens: header, metadata and every tile', async () => {
  const tiles = tilesAround(10, 14);
  const archive = writePmtiles(tiles, {
    tileType: TILE_TYPE.jpeg,
    bounds: BOUNDS,
    metadata: { attribution: 'USGS The National Map', name: 'Oak Ridge topo' },
  });
  const pm = reader(archive);
  const header = await pm.getHeader();
  expect(header).toMatchObject({
    specVersion: 3,
    minZoom: 10,
    maxZoom: 14,
    tileType: TILE_TYPE.jpeg,
    numAddressedTiles: tiles.length,
    clustered: true,
  });
  expect(header.minLon).toBeCloseTo(BOUNDS[0], 6);
  expect(header.maxLat).toBeCloseTo(BOUNDS[3], 6);
  expect(await pm.getMetadata()).toEqual({
    attribution: 'USGS The National Map',
    name: 'Oak Ridge topo',
  });
  for (const t of tiles) {
    const got = await pm.getZxy(t.z, t.x, t.y);
    expect(Buffer.from(got!.data).toString()).toBe(Buffer.from(t.data).toString());
  }
  expect(await pm.getZxy(14, 0, 0)).toBeUndefined();
});

it('stores identical tiles once (e.g. blank ocean or forest tiles)', async () => {
  const same = Buffer.from('identical jpeg');
  const tiles = tilesAround(12, 13).map((t) => ({ ...t, data: same }));
  const archive = writePmtiles(tiles, { tileType: TILE_TYPE.jpeg, bounds: BOUNDS });
  const header = await reader(archive).getHeader();
  expect(header.numTileContents).toBe(1);
  expect(archive.length).toBeLessThan(1_000);
  expect(Buffer.from((await reader(archive).getZxy(13, 2048, 2048))!.data)).toEqual(same);
});

it('uses leaf directories when the root would not fit, and still finds every tile', async () => {
  // 20,000 scattered tiles: their ids don't compress, so the root alone is too big.
  const tiles: Tile[] = Array.from({ length: 20_000 }, (_, i) => {
    const x = (i * 7919) % 65_536;
    const y = (i * 104_729) % 65_536;
    return { z: 16, x, y, data: Buffer.from(`jpeg 16/${x}/${y}`) };
  });
  const archive = writePmtiles(tiles, { tileType: TILE_TYPE.jpeg, bounds: BOUNDS });
  const pm = reader(archive);
  const header = await pm.getHeader();
  expect(header.leafDirectoryLength).toBeGreaterThan(0);
  expect(header.rootDirectoryLength).toBeLessThanOrEqual(16_384 - 127);
  for (const t of [tiles[0]!, tiles[9_999]!, tiles[tiles.length - 1]!]) {
    expect(Buffer.from((await pm.getZxy(t.z, t.x, t.y))!.data).toString()).toBe(
      `jpeg ${t.z}/${t.x}/${t.y}`,
    );
  }
});

it('refuses empty packs, duplicates and tiles outside the zoom grid', () => {
  expect(() => writePmtiles([], { tileType: TILE_TYPE.jpeg, bounds: BOUNDS })).toThrow(
    'at least one tile',
  );
  const t = { z: 3, x: 1, y: 1, data: Buffer.from('a') };
  expect(() => writePmtiles([t, t], { tileType: TILE_TYPE.jpeg, bounds: BOUNDS })).toThrow(
    'duplicate',
  );
  expect(() => zxyToTileId(3, 8, 0)).toThrow('out of range');
});
