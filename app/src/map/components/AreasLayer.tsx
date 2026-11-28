import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';

import type { ClubArea } from '../../checkin/placement';
import { colors, sizes } from '../../theme';

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
