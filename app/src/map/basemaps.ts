import type { StyleSpecification } from '@maplibre/maplibre-react-native';

import { colors } from '../theme';

// USGS basemap data lives in @huntclub/shared (also used by the club map-pack Lambda).
import {
  BASEMAPS,
  type Bounds,
  USGS_MAX_TILE_ZOOM,
  USGS_TILE_SIZE,
  type BasemapId,
} from '@huntclub/shared';

export {
  BASEMAP_IDS,
  BASEMAPS,
  USGS_MAX_TILE_ZOOM,
  USGS_TILE_SIZE,
  basemapBySource,
  type Basemap,
  type BasemapId,
} from '@huntclub/shared';

/** Free users fetch tiles straight from USGS; nothing goes through our backend. */
export const DEFAULT_BASEMAP: BasemapId = 'aerial';

/** The part of a downloaded club map pack the map needs (see club/mapPacks). */
export type ClubPackLayer = {
  /** file:// URI of the PMTiles archive on this phone. */
  localUri: string;
  bounds: Bounds;
  minZoom: number;
  maxZoom: number;
};

/** Source and layer id of the club map pack, drawn over the USGS tiles. */
export const CLUB_PACK_SOURCE = 'club-pack';

/**
 * The MapLibre style for a basemap: the USGS tiles (live, or from the phone's
 * own downloads), with the club's map pack on top where it covers the map.
 * The pack is read straight from the file, so it works with no signal.
 */
export function basemapStyle(id: BasemapId, clubPack?: ClubPackLayer): StyleSpecification {
  const basemap = BASEMAPS[id];
  const style: StyleSpecification = {
    version: 8,
    name: `Hunt Club ${basemap.label}`,
    sources: {
      [basemap.source]: {
        type: 'raster',
        tiles: [basemap.tileUrl],
        tileSize: USGS_TILE_SIZE,
        maxzoom: USGS_MAX_TILE_ZOOM,
        attribution: basemap.credit,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': colors.surface } },
      { id: basemap.source, type: 'raster', source: basemap.source },
    ],
  };
  if (!clubPack) return style;
  return {
    ...style,
    sources: {
      ...style.sources,
      [CLUB_PACK_SOURCE]: {
        type: 'raster',
        url: `pmtiles://${clubPack.localUri}`,
        tileSize: USGS_TILE_SIZE,
        minzoom: clubPack.minZoom,
        maxzoom: clubPack.maxZoom,
        bounds: [...clubPack.bounds],
        attribution: basemap.credit,
      },
    },
    layers: [...style.layers, { id: CLUB_PACK_SOURCE, type: 'raster', source: CLUB_PACK_SOURCE }],
  };
}
