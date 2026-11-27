import { Camera, Map } from '@maplibre/maplibre-react-native';
import { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { CONTINENTAL_US_VIEW, basemapStyle, DEFAULT_BASEMAP } from '../../map/basemaps';
import { MAP_CHROME_OFF, MapLayers } from '../../map/components/MapLayers';
import { createMapDataStore, useMapData } from '../../map/dataSource';
import { useFramedBounds } from '../../map/useFramedBounds';
import { connectMapData, nodePosition } from '../../map/meshMapData';
import { useIncomingAlerts } from '../../safety/hooks';
import { spacing } from '../../theme';
import type { BoardRadio } from '../BoardRadio';


/** The board's map: everyone out, help/overdue pins, framed around them and the clubhouse. */
export function BoardMap({ radio, now }: { radio: BoardRadio | null; now: number }) {
  const store = useMemo(() => createMapDataStore(), []);
  const data = useMapData(store);
  const alerts = useIncomingAlerts();
  const mapStyle = useMemo(() => basemapStyle(DEFAULT_BASEMAP), []);

  useEffect(() => (radio ? connectMapData(radio, store, radio.names) : undefined), [radio, store]);

  const self = radio?.client.nodes.get(radio.client.myNodeNum);
  const clubhouse = self ? nodePosition(self) : undefined;
  const bounds = useFramedBounds([
    ...data.hunters.map((h) => h.position),
    ...alerts.flatMap((a) => (a.pin ? [a.pin] : [])),
    ...(clubhouse ? [clubhouse] : []),
  ]);

  return (
    <Map style={styles.map} mapStyle={mapStyle} {...MAP_CHROME_OFF}>
      {bounds ? (
        <Camera bounds={bounds} padding={MAP_PADDING} duration={1000} />
      ) : (
        <Camera initialViewState={CONTINENTAL_US_VIEW} />
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
