// The reader against archives from our own writer (writer.test.ts checks those against the
// reference implementation), over the same range reads a browser makes.
import { gunzipSync, gzipSync } from 'node:zlib';
import {
  fetchRangeReader,
  openPmtiles,
  parseHeader,
  PmtilesFormatError,
  streamGunzip,
  type RangeReader,
} from '../reader';
import { TILE_TYPE, writePmtiles } from '../writer';
import { BOUNDS, scatteredTiles, tilesAround } from './fixtures';

/** Range reads over an archive in memory, counted. */
function memoryReader(archive: Buffer) {
  const reads: [number, number][] = [];
  const read: RangeReader = async (offset, length) => {
    reads.push([offset, length]);
    return new Uint8Array(archive.subarray(offset, offset + length));
  };
  return { read, reads };
}

const nodeGunzip = async (bytes: Uint8Array) => new Uint8Array(gunzipSync(bytes));
const text = (bytes: Uint8Array | null) => (bytes ? Buffer.from(bytes).toString() : null);

it('reads the header and root in one request, then each tile in one more', async () => {
  const tiles = tilesAround(10, 14);
  const archive = writePmtiles(tiles, { tileType: TILE_TYPE.jpeg, bounds: BOUNDS });
  const { read, reads } = memoryReader(archive);
  const pm = await openPmtiles(read, { gunzip: nodeGunzip });
  expect(reads).toHaveLength(1);
  expect(pm.header).toMatchObject({ minZoom: 10, maxZoom: 14, tileType: TILE_TYPE.jpeg });
  pm.header.bounds.forEach((deg, i) => expect(deg).toBeCloseTo(BOUNDS[i]!, 6));
  for (const t of tiles)
    expect(text(await pm.getTile(t.z, t.x, t.y))).toBe(`jpeg ${t.z}/${t.x}/${t.y}`);
  expect(reads).toHaveLength(1 + tiles.length);
});

it('says when the archive has no tile there', async () => {
  const archive = writePmtiles(tilesAround(12, 12), { tileType: TILE_TYPE.jpeg, bounds: BOUNDS });
  const pm = await openPmtiles(memoryReader(archive).read, { gunzip: nodeGunzip });
  expect(await pm.getTile(12, 0, 0)).toBeNull();
  expect(await pm.getTile(13, 2048, 2048)).toBeNull();
  // Just past the end of a run of tiles.
  expect(await pm.getTile(12, 1024 + 3, 1024)).toBeNull();
});

it('finds tiles in runs of identical content', async () => {
  const same = Buffer.from('forest');
  const tiles = tilesAround(12, 13).map((t) => ({ ...t, data: same }));
  const archive = writePmtiles(tiles, { tileType: TILE_TYPE.jpeg, bounds: BOUNDS });
  const pm = await openPmtiles(memoryReader(archive).read, { gunzip: nodeGunzip });
  for (const t of tiles) expect(text(await pm.getTile(t.z, t.x, t.y))).toBe('forest');
});

it('follows leaf directories, reading each leaf once', async () => {
  const tiles = scatteredTiles();
  const archive = writePmtiles(tiles, { tileType: TILE_TYPE.jpeg, bounds: BOUNDS });
  const { read, reads } = memoryReader(archive);
  const pm = await openPmtiles(read, { gunzip: nodeGunzip });
  for (const t of [tiles[0]!, tiles[9_999]!, tiles[tiles.length - 1]!, tiles[1]!]) {
    expect(text(await pm.getTile(t.z, t.x, t.y))).toBe(`jpeg ${t.z}/${t.x}/${t.y}`);
  }
  const leafReads = reads.filter(
    ([offset]) => offset >= pm.header.leavesOffset && offset < pm.header.dataOffset,
  );
  expect(new Set(leafReads.map(([o]) => o)).size).toBe(leafReads.length);
});

it('decompresses directories with the platform gzip stream by default', async () => {
  const tiles = tilesAround(11, 11);
  const archive = writePmtiles(tiles, { tileType: TILE_TYPE.png, bounds: BOUNDS });
  expect(text(await streamGunzip(new Uint8Array(gzipSync('hi'))))).toBe('hi');
  const pm = await openPmtiles(memoryReader(archive).read);
  expect(pm.header.tileType).toBe(TILE_TYPE.png);
  expect(text(await pm.getTile(11, 512, 512))).toBe('jpeg 11/512/512');
});

it('refuses what is not a PMTiles v3 archive', () => {
  expect(() => parseHeader(new Uint8Array(10))).toThrow(PmtilesFormatError);
  expect(() => parseHeader(new Uint8Array(200))).toThrow('not a PMTiles archive');
  const archive = writePmtiles(tilesAround(3, 3, 1), { tileType: TILE_TYPE.jpeg, bounds: BOUNDS });
  const v2 = Uint8Array.from(archive);
  v2[7] = 2;
  expect(() => parseHeader(v2)).toThrow('version 3');
});

describe('fetchRangeReader', () => {
  const archive = Buffer.from('0123456789');
  const fake = (honoursRange: boolean, status = 200) =>
    jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const range = new Headers(init?.headers).get('range')!;
      const [, from, to] = /bytes=(\d+)-(\d+)/.exec(range)!.map(Number);
      const body = honoursRange && status === 200 ? archive.subarray(from, to! + 1) : archive;
      return new Response(new Uint8Array(body), {
        status: honoursRange && status === 200 ? 206 : status,
      });
    });

  it('asks for exactly the bytes it needs', async () => {
    const fetchBytes = fake(true);
    const read = fetchRangeReader('/packs/c/p.pmtiles', fetchBytes as typeof fetch);
    expect(text(await read(2, 3))).toBe('234');
    expect(fetchBytes).toHaveBeenCalledWith('/packs/c/p.pmtiles', {
      headers: { range: 'bytes=2-4' },
    });
  });

  it('slices the whole file from a server that ignores Range', async () => {
    const read = fetchRangeReader('/p', fake(false) as typeof fetch);
    expect(text(await read(5, 2))).toBe('56');
  });

  it('fails on a missing archive', async () => {
    const read = fetchRangeReader('/p', fake(false, 404) as typeof fetch);
    await expect(read(0, 2)).rejects.toThrow('404');
  });
});
