import { GeoJSONSource, Layer, Marker } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';

import type { ClubArea } from '../../checkin/placement';
import { colors, sizes } from '../../theme';
import type { AreaLabel } from '../mapLabels';
import { MapLabel } from './MapLabel';

/**
 * The club's areas (docs/DESIGN.md "Dotted club areas"): each outline dotted in the map's text
 * colour, the same in both themes like the other map symbols. Areas with no outline on this
 * phone are not drawn.
 */
export function AreasLayer({ areas }: { areas: readonly ClubArea[] }) {
  const shapes = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: areas.flatMap((area) =>
        area.boundary
          ? [
              {
                type: 'Feature' as const,
                properties: { name: area.name },
                geometry: area.boundary as unknown as GeoJSON.Geometry,
              },
            ]
          : [],
      ),
    }),
    [areas],
  );
  if (shapes.features.length === 0) return null;
  return (
    <GeoJSONSource id="club-areas" data={shapes}>
      <Layer
        id="club-areas-line"
        type="line"
        paint={{
          'line-color': colors.text,
          'line-width': sizes.hairline,
          'line-dasharray': [1, 2],
        }}
      />
    </GeoJSONSource>
  );
}

/**
 * The areas' names (`mapLabels`): each centred inside its area's north edge, or moved off a stand
 * it would cover. Names take no taps, so a tap there reaches the map or the stand under it.
 */
export function AreaNames({ labels }: { labels: readonly AreaLabel[] }) {
  return (
    <>
      {labels.map((label) => (
        <Marker
          key={label.id}
          id={`area-name-${label.id}`}
          lngLat={[label.position.lon, label.position.lat]}
          anchor="center"
          offset={[0, label.dy]}
        >
          <MapLabel testID="area-label" text={label.text} pointerEvents="none" />
        </Marker>
      ))}
    </>
  );
}
