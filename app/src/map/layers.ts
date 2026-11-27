/**
 * What the map draws over the basemap, each switched on and off in the Map layers sheet
 * (docs/DESIGN.md "Layers as a sheet: three basemap thumbnails, then on/off rows").
 * Every layer starts on; the choice lasts while the app is open.
 */
export const MAP_LAYER_IDS = ['stands', 'hunters', 'scent'] as const;
export type MapLayerId = (typeof MAP_LAYER_IDS)[number];

export type MapLayerVisibility = Readonly<Record<MapLayerId, boolean>>;

export const ALL_LAYERS_ON: MapLayerVisibility = { stands: true, hunters: true, scent: true };

/** Each layer's row in the sheet. */
export const MAP_LAYER_LABELS: Record<MapLayerId, string> = {
  stands: 'Stands',
  hunters: 'Hunters checked in',
  scent: 'Wind and your scent',
};
