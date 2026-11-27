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
import { useClubMapPacks } from '../club/ClubProvider';
import { HarvestSheet } from '../harvest/HarvestSheet';
import { CheckOutSheet } from '../checkin/CheckOutSheet';
import { AskForHandSheet } from '../safety/components/AskForHandSheet';
import { useIncomingAlerts } from '../safety/hooks';
import { makeStyles, spacing } from '../theme';
import { conditionsReadout } from '@huntclub/shared';

import { useClubEntitlement } from '../club/entitlement';
import { BASEMAPS, CONTINENTAL_US_VIEW, DEFAULT_BASEMAP, baseOf, basemapStyle, type BasemapView } from './basemaps';
import { DownloadAreaSheet } from './components/DownloadAreaSheet';
import { HaloText } from './components/HaloText';
import { LayersSheet } from './components/LayersSheet';
import { MapBottomSheet } from './components/MapBottomSheet';
import { MapControls } from './components/MapControls';
import { MAP_CHROME_OFF, MapLayers } from './components/MapLayers';
import { ScaleBar } from './components/ScaleBar';
import { TopPlate } from './components/TopPlate';
import { YouMarker } from './components/YouMarker';
import { useNow } from '../hooks/useNow';
import { useMapData, type MapDataSource } from './dataSource';
import type { Bounds } from './tiles';
import type { LatLon } from '@huntclub/mesh';
import { ALL_LAYERS_ON, type MapLayerVisibility } from './layers';
import { placeOf } from './place';
import { useMapPacks } from './useMapPacks';
import { useYourLocation } from './useYourLocation';
import { useConditions } from '../weather/useConditions';

/** Zoom when centering on you: about 500 ft across the scale bar. */
const CENTER_ON_ME_ZOOM = 15.5;
/** Below this zoom the map centre is too vague for sunrise and sunset. */
const CONDITIONS_MIN_ZOOM = 8;

type MapView = { center: LatLon; zoom: number };
type Panel = 'layers' | 'download' | 'checkOut' | 'askForHand' | 'harvest' | null;

type Props = {
  /** Hunters, open stands and mesh status; defaults to the app store the radio will feed. */
  dataSource?: MapDataSource;
};

export function MapScreen({ dataSource }: Props) {
  const styles = useStyles();
  const data = useMapData(dataSource);
  const { radio, current } = useCheckInState();
  const alerts = useIncomingAlerts();
  const now = useNow();
  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  const club = useClubEntitlement();
  const [basemap, setBasemap] = useState<BasemapView>(DEFAULT_BASEMAP);
  const [layers, setLayers] = useState<MapLayerVisibility>(ALL_LAYERS_ON);
  const [view, setView] = useState<MapView>({
    center: { lon: CONTINENTAL_US_VIEW.center[0], lat: CONTINENTAL_US_VIEW.center[1] },
    zoom: CONTINENTAL_US_VIEW.zoom,
  });
  const [panel, setPanel] = useState<Panel>(null);
  const [downloadBounds, setDownloadBounds] = useState<Bounds | null>(null);
  const { position: you, locate } = useYourLocation();
  const { packs, progress, start, remove } = useMapPacks();

  const clubPacks = useClubMapPacks();
  const clubPack = clubPacks.find((pack) => pack.source === BASEMAPS[baseOf(basemap)].source);
  const mapStyle = useMemo(() => basemapStyle(basemap, clubPack), [basemap, clubPack]);

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
  const weather = useConditions(conditionsPlace, now);
  // Sunrise, sunset, wind and temperature: the strip, the scent cone and the sunset countdown.
  const readout = conditionsReadout({ place: conditionsPlace, now, ...weather });
  const audience = radio?.audience ?? 'party';
  const weatherUpdated =
    weather.updated && weather.updatedSpoken
      ? { short: weather.updated, spoken: weather.updatedSpoken }
      : null;

  return (
    <View style={styles.root}>
      <Map
        ref={mapRef}
        style={styles.map}
        mapStyle={mapStyle}
        {...MAP_CHROME_OFF}
        onRegionDidChange={onRegionChange}
      >
        <Camera ref={cameraRef} initialViewState={CONTINENTAL_US_VIEW} />
        <MapLayers data={data} alerts={alerts} now={now} layers={layers} />
        {/* No scent cone while the wind is calm or unknown, or with its layer off. */}
        {you ? (
          <YouMarker
            position={you}
            windFromDeg={layers.scent ? readout.wind.fromDeg : null}
          />
        ) : null}
      </Map>

      <SafeAreaView
        style={styles.overlay}
        edges={['top', 'left', 'right']}
        pointerEvents="box-none"
      >
        <View style={styles.top} pointerEvents="box-none">
          <TopPlate
            groupLabel={club?.clubName ?? 'Party'}
            onGroupPress={() => router.navigate('/party')}
            mesh={data.mesh}
            now={now}
            onMeshPress={() => router.navigate('/party')}
            readout={readout}
            weatherUpdated={weatherUpdated}
          />
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
          <HaloText>Map: {BASEMAPS[baseOf(basemap)].credit}</HaloText>
        </View>
        {current && radio ? (
          <MapBottomSheet
            state="checkedIn"
            place={placeOf(current.placement)}
            checkedInAt={current.checkedInAt}
            now={now}
            untilSunset={readout.untilSunset}
            audience={radio.audience}
            onAskForHand={() => setPanel('askForHand')}
            onCheckOut={() => setPanel('checkOut')}
            onChangeMode={() => router.navigate('/check-in')}
            onLogHarvest={() => setPanel('harvest')}
          />
        ) : (
          <MapBottomSheet
            state="notCheckedIn"
            untilSunset={readout.untilSunset}
            audience={audience}
            onAskForHand={() => setPanel('askForHand')}
            onCheckIn={() => router.navigate('/check-in')}
          />
        )}
      </SafeAreaView>

      <LayersSheet
        visible={panel === 'layers'}
        basemap={basemap}
        layers={layers}
        onLayerChange={(layer, on) => setLayers((current) => ({ ...current, [layer]: on }))}
        packs={packs}
        clubPack={clubPack}
        progress={progress}
        onSelect={setBasemap}
        onDownload={() => void openDownload()}
        onDelete={(id) => void remove(id)}
        onClose={() => setPanel(null)}
      />
      <CheckOutSheet radio={radio} visible={panel === 'checkOut'} onClose={() => setPanel(null)} />
      <AskForHandSheet visible={panel === 'askForHand'} onClose={() => setPanel(null)} />
      <HarvestSheet visible={panel === 'harvest'} onClose={() => setPanel(null)} />
      <DownloadAreaSheet
        visible={panel === 'download'}
        bounds={downloadBounds}
        onStart={start}
        onClose={() => setPanel('layers')}
      />
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.plate },
  map: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between' },
  top: { paddingHorizontal: spacing.sm + spacing.xs / 2, paddingTop: spacing.xs },
  // The control column hangs from just under the top plate, at the right edge.
  middle: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.sm + spacing.xs / 2,
    paddingTop: spacing.sm + spacing.xs,
  },
  bottomInfo: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
}));
