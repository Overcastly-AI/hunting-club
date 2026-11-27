import type { StyleSpecification } from '@maplibre/maplibre-react-native';

import { colors, opacity } from '../theme';

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

/**
 * What the layers sheet offers: the two USGS basemaps, and Hybrid, which draws the topo map
 * over the aerial (no third download: it is made on the phone from the two). Each works with
 * no signal once its basemaps are saved on the phone.
 */
export const BASEMAP_VIEWS = ['aerial', 'topo', 'hybrid'] as const;
export type BasemapView = (typeof BASEMAP_VIEWS)[number];

/** The basemaps each view draws, bottom first. */
export const VIEW_BASEMAPS: Record<BasemapView, readonly BasemapId[]> = {
  aerial: ['aerial'],
  topo: ['topo'],
  hybrid: ['aerial', 'topo'],
};

export const BASEMAP_VIEW_LABELS: Record<BasemapView, string> = {
  aerial: BASEMAPS.aerial.label,
  topo: BASEMAPS.topo.label,
  hybrid: 'Hybrid',
};

/** The basemap under a view: its club map pack, credit and attribution are this one's. */
export const baseOf = (view: BasemapView): BasemapId => VIEW_BASEMAPS[view][0]!;

/** The whole continental US: where every map starts until it knows where anyone is. */
export const CONTINENTAL_US_VIEW = { center: [-96, 39] as [number, number], zoom: 3.5 };

/** Free users fetch tiles straight from USGS; nothing goes through our backend. */
export const DEFAULT_BASEMAP: BasemapView = 'aerial';

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
 * The MapLibre style for a view: the USGS tiles (live, or from the phone's own downloads),
 * Hybrid's topo over the aerial at partial opacity, and the club's map pack on top where it
 * covers the map. The pack is read straight from the file, so it works with no signal.
 */
export function basemapStyle(view: BasemapView, clubPack?: ClubPackLayer): StyleSpecification {
  const basemaps = VIEW_BASEMAPS[view].map((id) => BASEMAPS[id]);
  const base = basemaps[0]!;
  const style: StyleSpecification = {
    version: 8,
    name: `Hunt Club ${BASEMAP_VIEW_LABELS[view]}`,
    sources: Object.fromEntries(
      basemaps.map((basemap) => [
        basemap.source,
        {
          type: 'raster',
          tiles: [basemap.tileUrl],
          tileSize: USGS_TILE_SIZE,
          maxzoom: USGS_MAX_TILE_ZOOM,
          attribution: basemap.credit,
        },
      ]),
    ),
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': colors.surface } },
      ...basemaps.map((basemap, index) =>
        index === 0
          ? { id: basemap.source, type: 'raster' as const, source: basemap.source }
          : {
              id: basemap.source,
              type: 'raster' as const,
              source: basemap.source,
              paint: { 'raster-opacity': opacity.hybridTopo },
            },
      ),
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
        attribution: base.credit,
      },
    },
    // Right above its own basemap (the background and the base layer), under Hybrid's topo.
    layers: [
      ...style.layers.slice(0, 2),
      { id: CLUB_PACK_SOURCE, type: 'raster', source: CLUB_PACK_SOURCE },
      ...style.layers.slice(2),
    ],
  };
}
