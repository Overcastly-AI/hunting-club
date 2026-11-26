import type { StyleSpecification } from '@maplibre/maplibre-react-native';

import { colors } from '../theme';

// USGS basemap data lives in @huntclub/shared (also used by the club map-pack Lambda).
import { BASEMAPS, USGS_MAX_TILE_ZOOM, USGS_TILE_SIZE, type BasemapId } from '@huntclub/shared';

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

/** A one-layer MapLibre style for a basemap. Used for the live map and for offline packs. */
export function basemapStyle(id: BasemapId): StyleSpecification {
  const basemap = BASEMAPS[id];
  return {
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
}
