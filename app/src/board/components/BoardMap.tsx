import { Camera, Map } from '@maplibre/maplibre-react-native';
import { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { basemapStyle, DEFAULT_BASEMAP } from '../../map/basemaps';
import { MAP_CHROME_OFF, MapLayers } from '../../map/components/MapLayers';
import { createMapDataStore, useMapData } from '../../map/dataSource';
import { boundsAround } from '../../map/geo';
import { connectMapData, nodePosition } from '../../map/meshMapData';
import { useIncomingAlerts } from '../../safety/hooks';
import { spacing } from '../../theme';
import type { BoardRadio } from '../BoardRadio';

/** Whole continental US until anyone or the board radio has a position. */
const FALLBACK_VIEW = { center: [-96, 39] as [number, number], zoom: 3.5 };

/** The board's map: everyone out, help/overdue pins, framed around them and the clubhouse. */
export function BoardMap({ radio, now }: { radio: BoardRadio | null; now: number }) {
  const store = useMemo(() => createMapDataStore(), []);
  const data = useMapData(store);
  const alerts = useIncomingAlerts();
  const mapStyle = useMemo(() => basemapStyle(DEFAULT_BASEMAP), []);

  useEffect(() => (radio ? connectMapData(radio, store, radio.names) : undefined), [radio, store]);

  const self = radio?.client.nodes.get(radio.client.myNodeNum);
  const clubhouse = self ? nodePosition(self) : undefined;
  const framed = boundsAround([
    ...data.hunters.map((h) => h.position),
    ...alerts.flatMap((a) => (a.pin ? [a.pin] : [])),
    ...(clubhouse ? [clubhouse] : []),
  ]);
  // Re-frame only when the box changes, not on every clock tick.
  const key = framed?.join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bounds = useMemo(() => framed, [key]);

  return (
    <Map style={styles.map} mapStyle={mapStyle} {...MAP_CHROME_OFF}>
      {bounds ? (
        <Camera bounds={bounds} padding={MAP_PADDING} duration={1000} />
      ) : (
        <Camera initialViewState={FALLBACK_VIEW} />
      )}
      <MapLayers data={data} alerts={alerts} now={now} />
    </Map>
  );
}

/** Room around the outermost markers for their names. */
const MAP_PADDING = {
  top: spacing.xl * 2,
  bottom: spacing.xl * 2,
  left: spacing.xl * 2,
  right: spacing.xl * 2,
};

const styles = StyleSheet.create({ map: { flex: 1 } });
