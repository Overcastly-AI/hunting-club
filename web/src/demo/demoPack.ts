// Dev-only: the demo club's ready aerial map pack. The demo lists it (demoServices.ts) and the
// screenshot script (scripts/shoot.ts) builds its archive with the real map-pack builder from
// USGS and serves it at its key, as CloudFront serves a real club's pack.
import {
  BASEMAPS,
  mapPackKey,
  polygonBounds,
  type BasemapId,
  type MapPack,
} from '@huntclub/shared';
import { SAMPLE_PROPERTY } from '../map/sampleProperty';

const PACK_ID = '5e0a3b4c-6d7e-4f8a-9b0c-1d2e3f4a5b90';
const BASEMAP: BasemapId = 'aerial';
/** One map zoom: the deepest USGS level, a square mile in about two dozen tiles. */
const ZOOM = 15;

export type ReadyMapPack = Extract<MapPack, { status: 'ready' }>;

/** The pack as the club API lists it. */
export function demoMapPack(clubId: string): ReadyMapPack {
  const at = '2026-11-25T12:00:00.000Z';
  return {
    id: PACK_ID,
    clubId,
    bounds: polygonBounds(SAMPLE_PROPERTY.boundary),
    minZoom: ZOOM,
    maxZoom: ZOOM,
    source: BASEMAPS[BASEMAP].source,
    s3Key: mapPackKey(clubId, PACK_ID),
    status: 'ready',
    sizeBytes: 0,
    builtAt: at,
    createdAt: at,
    updatedAt: at,
  };
}

/** What the map-pack builder is asked to build for it. */
export function demoMapPackBuild(clubId: string) {
  const pack = demoMapPack(clubId);
  return {
    clubId,
    packId: pack.id,
    basemap: BASEMAP,
    bounds: pack.bounds,
    minZoom: pack.minZoom,
    maxZoom: pack.maxZoom,
  };
}
