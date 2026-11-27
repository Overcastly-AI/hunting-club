import { Marker } from '@maplibre/maplibre-react-native';

import { HelpMarker } from '../../safety/components/HelpMarker';
import type { IncomingAlert } from '../../safety/alerts';
import { ALL_LAYERS_ON, type MapLayerVisibility } from '../layers';
import type { MapData } from '../types';
import { HunterMarker } from './HunterMarker';
import { MARKER_ANCHOR } from './MarkerPlate';
import { OpenStandMarker } from './OpenStandMarker';

/** MapLibre's own logo, attribution, compass and scale bar are off; the app draws its own. */
export const MAP_CHROME_OFF = {
  attribution: false,
  logo: false,
  compass: false,
  scaleBar: false,
} as const;

type Props = {
  data: Pick<MapData, 'hunters' | 'openStands'>;
  alerts: readonly IncomingAlert[];
  now: number;
  /** Which layers the hunter has switched on (Map layers sheet). */
  layers?: MapLayerVisibility;
  /** Rings only, no plates or stands: the chat's strip of map. */
  compact?: boolean;
};

/**
 * Open stands, other hunters and help/overdue pins: the shared layers of the Map tab, the
 * chat and Check In strips, and the clubhouse board. Help and overdue pins are never hidden.
 */
export function MapLayers({ data, alerts, now, layers = ALL_LAYERS_ON, compact }: Props) {
  return (
    <>
      {layers.stands && !compact
        ? data.openStands.map((stand) => (
            <Marker
              key={stand.id}
              id={`stand-${stand.id}`}
              lngLat={[stand.position.lon, stand.position.lat]}
              {...MARKER_ANCHOR}
            >
              <OpenStandMarker stand={stand} />
            </Marker>
          ))
        : null}
      {layers.hunters
        ? data.hunters.map((hunter) => (
            <Marker
              key={hunter.id}
              id={`hunter-${hunter.id}`}
              lngLat={[hunter.position.lon, hunter.position.lat]}
              {...MARKER_ANCHOR}
            >
              <HunterMarker hunter={hunter} now={now} compact={compact} />
            </Marker>
          ))
        : null}
      {alerts.map((alert) => (
        <HelpMarker key={alert.key} alert={alert} now={now} />
      ))}
    </>
  );
}
