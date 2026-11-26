import { Marker } from '@maplibre/maplibre-react-native';

import { HelpMarker } from '../../safety/components/HelpMarker';
import type { IncomingAlert } from '../../safety/alerts';
import type { MapData } from '../types';
import { HunterMarker } from './HunterMarker';
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
};

/** Open stands, other hunters and help/overdue pins: the shared layers of the Map tab and the clubhouse board. */
export function MapLayers({ data, alerts, now }: Props) {
  return (
    <>
      {data.openStands.map((stand) => (
        <Marker
          key={stand.id}
          id={`stand-${stand.id}`}
          lngLat={[stand.position.lon, stand.position.lat]}
          anchor="top"
        >
          <OpenStandMarker stand={stand} />
        </Marker>
      ))}
      {data.hunters.map((hunter) => (
        <Marker
          key={hunter.id}
          id={`hunter-${hunter.id}`}
          lngLat={[hunter.position.lon, hunter.position.lat]}
          anchor="top"
        >
          <HunterMarker hunter={hunter} now={now} />
        </Marker>
      ))}
      {alerts.map((alert) => (
        <HelpMarker key={alert.key} alert={alert} now={now} />
      ))}
    </>
  );
}
