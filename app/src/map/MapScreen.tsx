import {
  Camera,
  Map,
  type CameraRef,
  type MapRef,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCheckInState } from '../checkin/CheckInRadio';
import { CheckOutSheet } from '../checkin/CheckOutSheet';
import { AskForHandSheet } from '../safety/components/AskForHandSheet';
import { useIncomingAlerts } from '../safety/hooks';
import { colors, spacing } from '../theme';
import { BASEMAPS, DEFAULT_BASEMAP, basemapStyle, type BasemapId } from './basemaps';
import { DownloadAreaSheet } from './components/DownloadAreaSheet';
import { HaloText } from './components/HaloText';
import { LayersSheet } from './components/LayersSheet';
import { MapBottomSheet } from './components/MapBottomSheet';
import { MapControls } from './components/MapControls';
import { MAP_CHROME_OFF, MapLayers } from './components/MapLayers';
import { MeshStatusLine } from './components/MeshStatusLine';
import { ScaleBar } from './components/ScaleBar';
import { TopBar } from './components/TopBar';
import { YouMarker } from './components/YouMarker';
import { useNow } from '../hooks/useNow';
import { useMapData, type MapDataSource } from './dataSource';
import type { Bounds } from './tiles';
import type { LatLon } from '@huntclub/mesh';
import { placeOf } from './place';
import { useMapPacks } from './useMapPacks';
import { useYourLocation } from './useYourLocation';

/** Start over the continental US until we know where you are. */
const INITIAL_VIEW = { center: [-96, 39] as [number, number], zoom: 3.5 };
/** Zoom when centering on you: about 500 ft across the scale bar. */
const CENTER_ON_ME_ZOOM = 15.5;
/** Below this zoom the map centre is too vague for sunrise and sunset. */
const CONDITIONS_MIN_ZOOM = 8;

type MapView = { center: LatLon; zoom: number };
type Panel = 'layers' | 'download' | 'checkOut' | 'askForHand' | null;

type Props = {
  /** Hunters, open stands and mesh status; defaults to the app store the radio will feed. */
  dataSource?: MapDataSource;
};

export function MapScreen({ dataSource }: Props) {
  const data = useMapData(dataSource);
  const { radio, current } = useCheckInState();
  const alerts = useIncomingAlerts();
  const now = useNow();
  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  const [basemap, setBasemap] = useState<BasemapId>(DEFAULT_BASEMAP);
  const [view, setView] = useState<MapView>({
    center: { lon: INITIAL_VIEW.center[0], lat: INITIAL_VIEW.center[1] },
    zoom: INITIAL_VIEW.zoom,
  });
  const [panel, setPanel] = useState<Panel>(null);
  const [downloadBounds, setDownloadBounds] = useState<Bounds | null>(null);
  const { position: you, locate } = useYourLocation();
  const { packs, progress, start, remove } = useMapPacks();

  const mapStyle = useMemo(() => basemapStyle(basemap), [basemap]);

  const onRegionChange = useCallback((event: NativeSyntheticEvent<ViewStateChangeEvent>) => {
    const { center, zoom } = event.nativeEvent;
    setView({ center: { lon: center[0], lat: center[1] }, zoom });
  }, []);

  const centerOnMe = useCallback(async () => {
    const position = await locate();
    if (position) {
      cameraRef.current?.flyTo({ center: [position.lon, position.lat], zoom: CENTER_ON_ME_ZOOM });
    }
  }, [locate]);

  const openDownload = useCallback(async () => {
    const bounds = await mapRef.current?.getBounds();
    setDownloadBounds(bounds ?? null);
    setPanel('download');
  }, []);

  const conditionsPlace = you ?? (view.zoom >= CONDITIONS_MIN_ZOOM ? view.center : null);

  return (
    <View style={styles.root}>
      <Map
        ref={mapRef}
        style={styles.map}
        mapStyle={mapStyle}
        {...MAP_CHROME_OFF}
        onRegionDidChange={onRegionChange}
      >
        <Camera ref={cameraRef} initialViewState={INITIAL_VIEW} />
        <MapLayers data={data} alerts={alerts} now={now} />
        {/* Wind arrives with the forecast milestone; until then no scent cone. */}
        {you ? <YouMarker position={you} /> : null}
      </Map>

      <SafeAreaView
        style={styles.overlay}
        edges={['top', 'left', 'right']}
        pointerEvents="box-none"
      >
        <View style={styles.top} pointerEvents="box-none">
          <TopBar
            groupLabel="Party"
            onGroupPress={() => router.navigate('/party')}
            conditionsPlace={conditionsPlace}
            now={now}
          />
          <MeshStatusLine status={data.mesh} now={now} onPress={() => router.navigate('/party')} />
        </View>
        <View style={styles.middle} pointerEvents="box-none">
          <MapControls
            onLayers={() => setPanel('layers')}
            onNorthUp={() =>
              cameraRef.current?.easeTo({ center: [view.center.lon, view.center.lat], bearing: 0 })
            }
            onCenterOnMe={() => void centerOnMe()}
          />
        </View>
        <View style={styles.bottomInfo} pointerEvents="box-none">
          <ScaleBar lat={view.center.lat} zoom={view.zoom} />
          <HaloText>Map: {BASEMAPS[basemap].credit}</HaloText>
        </View>
        {current && radio ? (
          <MapBottomSheet
            state="checkedIn"
            place={placeOf(current.placement)}
            checkedInAt={current.checkedInAt}
            now={now}
            audience={radio.audience}
            onAskForHand={() => setPanel('askForHand')}
            onCheckOut={() => setPanel('checkOut')}
            onChangeMode={() => router.navigate('/check-in')}
            onLogHarvest={() => undefined /* Milestone 7 */}
          />
        ) : (
          <MapBottomSheet state="notCheckedIn" onCheckIn={() => router.navigate('/check-in')} />
        )}
      </SafeAreaView>

      <LayersSheet
        visible={panel === 'layers'}
        basemap={basemap}
        packs={packs}
        progress={progress}
        onSelect={setBasemap}
        onDownload={() => void openDownload()}
        onDelete={(id) => void remove(id)}
        onClose={() => setPanel(null)}
      />
      <CheckOutSheet radio={radio} visible={panel === 'checkOut'} onClose={() => setPanel(null)} />
      <AskForHandSheet visible={panel === 'askForHand'} onClose={() => setPanel(null)} />
      <DownloadAreaSheet
        visible={panel === 'download'}
        bounds={downloadBounds}
        onStart={start}
        onClose={() => setPanel('layers')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  map: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between' },
  top: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
  middle: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  bottomInfo: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
});
