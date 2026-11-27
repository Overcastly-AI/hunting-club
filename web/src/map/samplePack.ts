// The sample property's aerial map pack. The sign-in page draws it, dimmed, under the sample
// property, read exactly as My club reads a club's own pack (basemap.ts): same-origin range
// requests for packs/sample/<id>.pmtiles on the web bucket, nothing in the CSP to loosen. Until
// that archive is uploaded there, the sample stands on its plain ground. The dev-only demo
// lists the same pack for its club, and the screenshot script (scripts/shoot.ts) builds the
// archive with the real map-pack builder from USGS.
import { BASEMAPS, mapPackKey, polygonBounds, type BasemapId } from '@huntclub/shared';
import type { ReadyPack } from './basemap';
import { SAMPLE_PROPERTY } from './sampleProperty';

const PACK_ID = '5e0a3b4c-6d7e-4f8a-9b0c-1d2e3f4a5b90';
const BASEMAP: BasemapId = 'aerial';
/** One map zoom: the deepest USGS level, a square mile in about two dozen tiles. */
const ZOOM = 15;
const BUILT_AT = '2026-11-25T12:00:00.000Z';

/** The sample pack as the club API would list it for `owner` (a club id, or SAMPLE_PACK_OWNER). */
export function samplePack(owner: string): ReadyPack {
  return {
    id: PACK_ID,
    clubId: owner,
    bounds: polygonBounds(SAMPLE_PROPERTY.boundary),
    minZoom: ZOOM,
    maxZoom: ZOOM,
    source: BASEMAPS[BASEMAP].source,
    s3Key: mapPackKey(owner, PACK_ID),
    status: 'ready',
    sizeBytes: 0,
    builtAt: BUILT_AT,
    createdAt: BUILT_AT,
    updatedAt: BUILT_AT,
  };
}

/** The key folder of the public sample pack (not a club). */
export const SAMPLE_PACK_OWNER = 'sample';

/** The pack behind the sign-in form: packs/sample/<id>.pmtiles. */
export const SAMPLE_PACK = samplePack(SAMPLE_PACK_OWNER);

/** What the map-pack builder is asked to build for it. */
export function samplePackBuild(owner: string) {
  const pack = samplePack(owner);
  return {
    clubId: owner,
    packId: pack.id,
    basemap: BASEMAP,
    bounds: pack.bounds,
    minZoom: pack.minZoom,
    maxZoom: pack.maxZoom,
  };
}
