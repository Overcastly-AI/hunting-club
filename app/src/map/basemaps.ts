import type { StyleSpecification } from '@maplibre/maplibre-react-native';

import { colors } from '../theme';

/**
 * Free basemaps from USGS The National Map (public domain), confirmed
 * 2026-11-26 against each service's `?f=json`:
 * - Cached Web Mercator (wkid 3857) services, 256 px JPEG tiles, `/tile/{z}/{y}/{x}`.
 * - The cache's coarsest scale (maxScale 9027.98) is tile level 16; deeper
 *   levels are not cached, so we cap there and let the map overzoom.
 * - USGSImageryTopo no longer exists (404), so aerial is USGSImageryOnly.
 * Free users fetch these straight from USGS; nothing goes through our backend.
 */
const USGS_BASEMAP_ROOT = 'https://basemap.nationalmap.gov/arcgis/rest/services';

/** Deepest cached USGS tile level. */
export const USGS_MAX_TILE_ZOOM = 16;
/** USGS tiles are 256 px. MapLibre zoom is 512 px based, so map zoom = tile zoom - 1. */
export const USGS_TILE_SIZE = 256;

export type BasemapId = 'topo' | 'aerial';

export type Basemap = {
  id: BasemapId;
  /** Word label in the layer switcher. */
  label: string;
  /** Stored in `map_packs.source`. */
  source: string;
  tileUrl: string;
  /** Short credit always visible on the map. */
  credit: string;
  /** The service's own copyrightText, shown in full from the layers panel. */
  attribution: string;
  /**
   * Average bytes per tile used for download size estimates. Measured tiles
   * were 21–29 KB; these round up so estimates err high (forest imagery is larger).
   */
  averageTileBytes: number;
};

const usgsTiles = (service: string) => `${USGS_BASEMAP_ROOT}/${service}/MapServer/tile/{z}/{y}/{x}`;

export const BASEMAPS: Record<BasemapId, Basemap> = {
  topo: {
    id: 'topo',
    label: 'Topo',
    source: 'usgs-topo',
    tileUrl: usgsTiles('USGSTopo'),
    credit: 'USGS The National Map',
    attribution:
      'USGS The National Map: National Boundaries Dataset, 3DEP Elevation Program, Geographic Names Information System, National Hydrography Dataset, National Land Cover Database, National Structures Dataset, and National Transportation Dataset; USGS Global Ecosystems; U.S. Census Bureau TIGER/Line data; USFS Road data; Natural Earth Data; U.S. Department of State HIU; NOAA National Centers for Environmental Information.',
    averageTileBytes: 32_000,
  },
  aerial: {
    id: 'aerial',
    label: 'Aerial',
    source: 'usgs-imagery',
    tileUrl: usgsTiles('USGSImageryOnly'),
    credit: 'USDA, USGS The National Map',
    attribution: 'USDA, USGS The National Map: Orthoimagery.',
    averageTileBytes: 40_000,
  },
};

export const BASEMAP_IDS = Object.keys(BASEMAPS) as BasemapId[];
export const DEFAULT_BASEMAP: BasemapId = 'aerial';

export function basemapBySource(source: string): Basemap | undefined {
  return Object.values(BASEMAPS).find((basemap) => basemap.source === source);
}

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
