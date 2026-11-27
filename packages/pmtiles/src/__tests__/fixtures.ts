// Archives for the writer and reader tests (one source).
import type { Tile } from '../writer';

export const BOUNDS = [-90.01, 39.99, -89.98, 40.02] as const;

/** Every tile covering a small square at zooms min..max, each with unique bytes. */
export function tilesAround(minZoom: number, maxZoom: number, size = 3): Tile[] {
  const tiles: Tile[] = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const cx = Math.floor(2 ** z * 0.25);
    for (let x = cx; x < cx + size; x++)
      for (let y = cx; y < cx + size; y++)
        tiles.push({ z, x, y, data: Buffer.from(`jpeg ${z}/${x}/${y}`) });
  }
  return tiles;
}

/** 20,000 scattered tiles: their ids don't compress, so the root alone is too big for leaves. */
export function scatteredTiles(): Tile[] {
  return Array.from({ length: 20_000 }, (_, i) => {
    const x = (i * 7919) % 65_536;
    const y = (i * 104_729) % 65_536;
    return { z: 16, x, y, data: Buffer.from(`jpeg 16/${x}/${y}`) };
  });
}
