// What the club plan is drawn on. Two sources, one picture type:
// - Live USGS tiles (liveBasemap): the shared BASEMAPS tile templates, shown as plain images,
//   so the CSP allows only the USGS origin in img-src (never connect-src). They need a
//   connection; offline they simply do not show.
// - The club's own map pack (loadBasemap): a PMTiles archive the map-pack builder wrote to the
//   web bucket (packs/<clubId>/<packId>.pmtiles), so CloudFront serves it from the admin's own
//   origin: same-origin range requests (connect-src 'self'), each tile shown as a data: image.
//   It is read once, so it still shows when the live tiles cannot load.
// With neither, the plan is drawn on its plain ground.
import {
  fetchRangeReader,
  openPmtiles,
  type Gunzip,
  type PmtilesHeader,
  type RangeReader,
  TILE_TYPE,
} from '@huntclub/pmtiles/reader';

import {
  BASEMAP_IDS,
  BASEMAPS,
  basemapBySource,
  mapPackPath,
  rangeTileCount,
  tileBounds,
  tileRangeAt,
  tileUrl,
  USGS_MAX_TILE_ZOOM,
  type Basemap,
  type BasemapId,
  type Bounds,
  type MapPack,
} from '@huntclub/shared';
import { useEffect, useState } from 'react';
import type { Projection } from './plan';

/** Where this browser remembers the live basemap last chosen (per browser, never sent). */
export const BASEMAP_STORAGE_KEY = 'hcm-basemap';

/** The basemap this browser last chose, else `fallback` (also when storage is blocked). */
export function storedBasemap(fallback: BasemapId): BasemapId {
  try {
    const stored = localStorage.getItem(BASEMAP_STORAGE_KEY);
    return BASEMAP_IDS.find((id) => id === stored) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Remembers the chosen basemap for the next visit; a browser that refuses storage just forgets. */
export function storeBasemap(id: BasemapId): void {
  try {
    localStorage.setItem(BASEMAP_STORAGE_KEY, id);
  } catch {
    // Private mode or blocked storage: the choice lasts for this visit only.
  }
}

/** At most this many tiles under the plan: enough for a square mile at the deepest level. */
export const BASEMAP_MAX_TILES = 64;

export type ReadyPack = Extract<MapPack, { status: 'ready' }>;

/** One tile of the picture: where it lies on the ground and the image to draw there. */
export interface BasemapTile {
  key: string;
  bounds: Bounds;
  href: string;
}

/** The picture under the plan, and the basemap it came from (for its credit). */
export interface BasemapPicture {
  basemap: Basemap;
  tiles: BasemapTile[];
}

/**
 * The pack drawn under the plan: the newest ready one of the `prefer`red basemap (aerial, the
 * picture the design is drawn for, unless the map shows another), else the newest ready one.
 * None while every pack is building or failed.
 */
export function basemapPack(
  packs: readonly MapPack[] | undefined,
  prefer: BasemapId = 'aerial',
): ReadyPack | undefined {
  const ready = (packs ?? [])
    .filter((p): p is ReadyPack => p.status === 'ready' && basemapBySource(p.source) !== undefined)
    .sort((a, b) => Date.parse(b.builtAt) - Date.parse(a.builtAt));
  return ready.find((p) => basemapBySource(p.source)!.id === prefer) ?? ready[0];
}

/**
 * The live USGS tiles covering a view, at the whole tile zoom nearest the view's (the deepest
 * cached level when closer in, drawn larger): the shared BASEMAPS template, as plain images.
 */
export function liveBasemap(
  id: BasemapId,
  projection: Projection,
  width: number,
  height: number,
): BasemapPicture {
  const z = Math.max(0, Math.min(USGS_MAX_TILE_ZOOM, Math.round(projection.view.zoom)));
  const [west, north] = projection.unproject(0, 0);
  const [east, south] = projection.unproject(width, height);
  const range = tileRangeAt([west, south, east, north], z);
  const tiles: BasemapTile[] = [];
  for (let x = range.minX; x <= range.maxX; x++)
    for (let y = range.minY; y <= range.maxY; y++)
      tiles.push({
        key: `${id}/${z}/${x}/${y}`,
        bounds: tileBounds(z, x, y),
        href: tileUrl(id, z, x, y),
      });
  return { basemap: BASEMAPS[id], tiles };
}

/** The deepest zoom in the archive whose tiles over its bounds stay within `maxTiles`. */
export function basemapZoom(header: PmtilesHeader, maxTiles = BASEMAP_MAX_TILES): number {
  for (let z = header.maxZoom; z > header.minZoom; z--) {
    if (rangeTileCount(tileRangeAt(header.bounds, z)) <= maxTiles) return z;
  }
  return header.minZoom;
}

const MIME: Partial<Record<number, string>> = {
  [TILE_TYPE.jpeg]: 'image/jpeg',
  [TILE_TYPE.png]: 'image/png',
  [TILE_TYPE.webp]: 'image/webp',
};

/** A data: URL for image bytes (img-src allows data:, not blob:). */
function dataUrl(bytes: Uint8Array, mime: string): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

export interface BasemapDeps {
  /** Range reads of the archive (default: same-origin fetch of the pack's path). */
  read?: RangeReader;
  gunzip?: Gunzip;
}

/** Reads one zoom level of a ready pack: the tiles over its bounds, as images. */
export async function loadBasemap(
  pack: ReadyPack,
  deps: BasemapDeps = {},
): Promise<BasemapPicture> {
  const basemap = basemapBySource(pack.source);
  if (!basemap) throw new Error('unknown basemap');
  const archive = await openPmtiles(deps.read ?? fetchRangeReader(mapPackPath(pack)), {
    ...(deps.gunzip ? { gunzip: deps.gunzip } : {}),
  });
  const mime = MIME[archive.header.tileType];
  if (!mime) throw new Error('not an image pack');
  const range = tileRangeAt(archive.header.bounds, basemapZoom(archive.header));
  const wanted: { x: number; y: number }[] = [];
  for (let x = range.minX; x <= range.maxX; x++)
    for (let y = range.minY; y <= range.maxY; y++) wanted.push({ x, y });
  const tiles = await Promise.all(
    wanted.map(async ({ x, y }) => {
      const bytes = await archive.getTile(range.z, x, y);
      return bytes
        ? {
            key: `${range.z}/${x}/${y}`,
            bounds: tileBounds(range.z, x, y),
            href: dataUrl(bytes, mime),
          }
        : null;
    }),
  );
  return { basemap, tiles: tiles.filter((t): t is BasemapTile => t !== null) };
}

/**
 * The picture of the club's pack, once read; null until then, and for good when there is no
 * ready pack or it cannot be read (offline): the plan then stands on its own. Only reads.
 */
export function useBasemap(pack: ReadyPack | undefined, deps?: BasemapDeps): BasemapPicture | null {
  const [picture, setPicture] = useState<{ key: string; value: BasemapPicture } | null>(null);
  const key = pack?.s3Key;
  useEffect(() => {
    if (!pack) return;
    let live = true;
    loadBasemap(pack, deps).then(
      (value) => live && setPicture({ key: pack.s3Key, value }),
      () => undefined,
    );
    return () => {
      live = false;
    };
    // The pack's key names its archive; deps are fixed for a page's life.
  }, [key]);
  return picture && picture.key === key ? picture.value : null;
}
