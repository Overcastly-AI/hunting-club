import { chromePinned, mapChrome, type SheetDetent } from '@huntclub/design';
import {
  Camera,
  Map,
  type CameraRef,
  type MapRef,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCheckInState } from '../checkin/CheckInRadio';
import { overdueTime } from '../checkin/overdueNote';
import { sortStands, type ClubStand } from '../checkin/placement';
import { useClubMapPacks } from '../club/ClubProvider';
import { HarvestSheet } from '../harvest/HarvestSheet';
import { CheckOutSheet } from '../checkin/CheckOutSheet';
import { AskForHandSheet } from '../safety/components/AskForHandSheet';
import { useIncomingAlerts } from '../safety/hooks';
import { makeStyles, spacing } from '../theme';
import { clockReadout, conditionsReadout, nextTimeReadout } from '@huntclub/shared';

import { useClubEntitlement } from '../club/entitlement';
import {
  BASEMAPS,
  CONTINENTAL_US_VIEW,
  DEFAULT_BASEMAP,
  baseOf,
  basemapStyle,
  type BasemapView,
} from './basemaps';
import { useAutoHide } from './chrome/useAutoHide';
import { AreasLayer } from './components/AreasLayer';
import { DownloadAreaSheet } from './components/DownloadAreaSheet';
import { LayersSheet } from './components/LayersSheet';
import { MapBottomSheet, type NearestStand } from './components/MapBottomSheet';
import { MapControls } from './components/MapControls';
import { MapFooter } from './components/MapFooter';
import { MAP_CHROME_OFF, MapLayers } from './components/MapLayers';
import { MapPill } from './components/MapPill';
import { YouMarker } from './components/YouMarker';
import { useNow } from '../hooks/useNow';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useMapData, type MapDataSource } from './dataSource';
import { boundsAround, distanceMeters, formatDistance, type CameraView } from './geo';
import { describeMeshStatus } from './meshStatus';
import type { Bounds } from './tiles';
import { ALL_LAYERS_ON, MAP_LAYER_IDS, type MapLayerVisibility } from './layers';
import { placeOf } from './place';
import { labelledStands } from './standLabels';
import { useMapPacks } from './useMapPacks';
import { useYourLocation } from './useYourLocation';
import { useConditions } from '../weather/useConditions';

/** Zoom when centering on you: about 500 ft across the scale bar. */
const CENTER_ON_ME_ZOOM = 15.5;
/** Zoom when showing a stand from the sheet: its name shows (labels.minZoom and up). */
const SHOW_STAND_ZOOM = 16;
/** Below this zoom the map centre is too vague for sunrise and sunset. */
const CONDITIONS_MIN_ZOOM = 8;
/** Room around the property when framing it. */
const FIT_PADDING = { top: spacing.xl, bottom: spacing.xl, left: spacing.xl, right: spacing.xl };
/** The footer line sits this far above the sheet's peek. */
const FOOTER_ABOVE_PEEK = spacing.xs;

type Panel = 'layers' | 'download' | 'checkOut' | 'askForHand' | 'harvest' | null;

export type MapScreenProps = {
  /** Hunters, open stands and mesh status; defaults to the app store the radio will feed. */
  dataSource?: MapDataSource;
  /** Where the map opens (default: the continental US). */
  initialView?: { center: [number, number]; zoom: number };
  /** Opens a panel (Layers) or closes any, when it changes (the dev-only screenshot mode). */
  panel?: 'layers' | null;
  /** Moves the sheet to a detent when it changes (the dev-only screenshot mode). */
  detent?: SheetDetent;
};

/**
 * The Map tab, map first (docs/DESIGN.md "Map chrome"): the map edge to edge under one top
 * pill, a right-edge stack of Layers and Find me, one footer line and one bottom sheet with
 * detents. Moving the map fades the pill, stack and footer; the sheet's peek never hides.
 * Everything here works offline and the same on iOS and Android.
 */
export function MapScreen({
  dataSource,
  initialView = CONTINENTAL_US_VIEW,
  panel: requestedPanel,
  detent: requestedDetent,
}: MapScreenProps) {
  const styles = useStyles();
  const data = useMapData(dataSource);
  const { radio, current } = useCheckInState();
  const alerts = useIncomingAlerts();
  const now = useNow();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  const club = useClubEntitlement();
  const [basemap, setBasemap] = useState<BasemapView>(DEFAULT_BASEMAP);
  const [layers, setLayers] = useState<MapLayerVisibility>(ALL_LAYERS_ON);
  const [view, setView] = useState<CameraView>({
    center: { lon: initialView.center[0], lat: initialView.center[1] },
    zoom: initialView.zoom,
    bearing: 0,
  });
  // The screen's own size (the map runs under the status bar, down to the tab bar).
  const [size, setSize] = useState({ width: window.width, height: window.height });
  const [panel, setPanel] = useState<Panel>(requestedPanel ?? null);
  const [detent, setDetent] = useState<SheetDetent>(requestedDetent ?? 'peek');
  // A new requested panel or detent applies, during render (no effect round trip).
  const [lastRequest, setLastRequest] = useState({ requestedPanel, requestedDetent });
  if (
    requestedPanel !== lastRequest.requestedPanel ||
    requestedDetent !== lastRequest.requestedDetent
  ) {
    setLastRequest({ requestedPanel, requestedDetent });
    if (requestedPanel !== undefined) setPanel(requestedPanel);
    if (requestedDetent !== undefined) setDetent(requestedDetent);
  }
  const [cardOpen, setCardOpen] = useState(false);
  const [selectedStand, setSelectedStand] = useState<string | null>(null);
  const [downloadBounds, setDownloadBounds] = useState<Bounds | null>(null);
  const { position: you, locate } = useYourLocation();
  const { packs, progress, start, remove } = useMapPacks();

  const clubPacks = useClubMapPacks();
  const clubPack = clubPacks.find((pack) => pack.source === BASEMAPS[baseOf(basemap)].source);
  const mapStyle = useMemo(() => basemapStyle(basemap, clubPack), [basemap, clubPack]);
  const clubStands = radio?.club?.stands;
  const clubAreas = radio?.club?.areas;

  const conditionsPlace = you ?? (view.zoom >= CONDITIONS_MIN_ZOOM ? view.center : null);
  const weather = useConditions(conditionsPlace, now);
  // Sunrise, sunset, wind and temperature: the pill's card, the scent cone and the next time.
  const readout = conditionsReadout({ place: conditionsPlace, now, ...weather });
  const audience = radio?.audience ?? 'party';
  const weatherUpdated =
    weather.updated && weather.updatedSpoken
      ? { short: weather.updated, spoken: weather.updatedSpoken }
      : null;
  const overdueAt = current
    ? overdueTime(
        current.checkedInAt,
        current.placement.pin ?? you ?? undefined,
        radio?.graceMinutes ?? 0,
        current.until,
      )
    : undefined;
  const next = nextTimeReadout(readout, overdueAt, now, { overdueFirst: !!current });
  const mesh = describeMeshStatus(data.mesh, now);

  // Auto-hide, except during an alert, while the mesh is quiet and near an overdue time.
  const pinned = chromePinned({
    now,
    overdueAt,
    alertActive: alerts.length > 0,
    meshQuiet: mesh.tone === 'quiet',
  });
  const chrome = useAutoHide(pinned || cardOpen);
  const { onMoveStart, onMoveEnd, show } = chrome;

  const mapTop = insets.top;
  const mapHeight = Math.max(0, size.height - mapTop);
  const peekHeight = mapChrome.sheet.peekBySurface.app;
  const standLabels = useMemo(
    () => labelledStands(data.openStands, view, size, selectedStand),
    [data.openStands, view, size, selectedStand],
  );

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  }, []);

  const onRegionDidChange = useCallback(
    (event: NativeSyntheticEvent<ViewStateChangeEvent>) => {
      const { center, zoom, bearing } = event.nativeEvent;
      setView({ center: { lon: center[0], lat: center[1] }, zoom, bearing: bearing ?? 0 });
      onMoveEnd();
    },
    [onMoveEnd],
  );

  const onMapPress = useCallback(() => {
    show();
    setCardOpen(false);
    setSelectedStand(null);
  }, [show]);

  const centerOnMe = useCallback(async () => {
    const position = await locate();
    if (position) {
      cameraRef.current?.flyTo({ center: [position.lon, position.lat], zoom: CENTER_ON_ME_ZOOM });
    }
  }, [locate]);

  // The club's ground: its map pack's box, else around its stands. Nothing for a free party.
  const property =
    clubPack?.bounds ??
    (clubStands?.length ? boundsAround(clubStands.map((s) => s.position)) : undefined);
  const fitProperty = useCallback(() => {
    if (property) cameraRef.current?.fitBounds(property, { padding: FIT_PADDING });
    setPanel(null);
  }, [property]);

  const showStand = useCallback((stand: ClubStand) => {
    cameraRef.current?.flyTo({
      center: [stand.position.lon, stand.position.lat],
      zoom: SHOW_STAND_ZOOM,
    });
    setDetent('peek');
  }, []);

  const openDownload = useCallback(async () => {
    const bounds = await mapRef.current?.getBounds();
    setDownloadBounds(bounds ?? null);
    setPanel('download');
  }, []);

  const nearest = clubStands ? sortStands(clubStands, you ?? undefined)[0] : undefined;
  const nearestStand: NearestStand | null =
    nearest && !nearest.occupiedBy
      ? {
          stand: nearest,
          distance: you ? formatDistance(distanceMeters(you, nearest.position)) : null,
        }
      : null;
  const names = {
    stand: (id: number) => clubStands?.find((s) => s.meshId === id)?.name,
    area: (id: number) => clubAreas?.find((a) => a.meshId === id)?.name,
  };
  const hasAreas = !!clubAreas?.some((a) => a.boundary);

  // The faded pieces take no taps and are hidden from screen readers.
  const fade = {
    style: { opacity: chrome.opacity },
    pointerEvents: chrome.hidden ? ('none' as const) : ('box-none' as const),
    accessibilityElementsHidden: chrome.hidden,
    importantForAccessibility: chrome.hidden ? ('no-hide-descendants' as const) : ('auto' as const),
  };
  const sheetCommon = {
    mapTop,
    mapHeight,
    detent,
    onDetent: setDetent,
    reduceMotion,
    audience,
    onAskForHand: () => setPanel('askForHand'),
    onLogHarvest: () => setPanel('harvest'),
    nearestStand,
    onShowStand: showStand,
    hunters: data.hunters,
    now,
  };

  return (
    <View style={styles.root} onLayout={onLayout} testID="map-screen">
      <Map
        ref={mapRef}
        testID="map"
        style={styles.map}
        mapStyle={mapStyle}
        {...MAP_CHROME_OFF}
        onRegionWillChange={onMoveStart}
        onRegionDidChange={onRegionDidChange}
        onPress={onMapPress}
      >
        <Camera ref={cameraRef} initialViewState={initialView} />
        {layers.areas && clubAreas ? <AreasLayer areas={clubAreas} /> : null}
        <MapLayers
          data={data}
          alerts={alerts}
          now={now}
          layers={layers}
          standLabels={standLabels}
          onStandPress={setSelectedStand}
        />
        {/* No scent cone while the wind is calm or unknown, or with its layer off. */}
        {you ? (
          <YouMarker position={you} windFromDeg={layers.scent ? readout.wind.fromDeg : null} />
        ) : null}
      </Map>

      <Animated.View
        testID="map-chrome-pill"
        {...fade}
        style={[
          styles.pill,
          {
            top: mapTop + mapChrome.inset,
            left: insets.left + mapChrome.inset,
            // Room to the stack's left: the pill and its card never run under it.
            width:
              size.width -
              insets.left -
              insets.right -
              3 * mapChrome.inset -
              mapChrome.stack.button,
          },
          fade.style,
        ]}
      >
        <MapPill
          groupLabel={club?.clubName ?? 'Party'}
          mesh={data.mesh}
          now={now}
          next={next}
          readout={readout}
          weatherUpdated={weatherUpdated}
          overdueAt={overdueAt === undefined ? null : clockReadout(overdueAt)}
          open={cardOpen}
          onToggle={() => setCardOpen((open) => !open)}
          onParty={() => {
            setCardOpen(false);
            router.navigate('/party');
          }}
        />
      </Animated.View>

      <Animated.View
        testID="map-chrome-stack"
        {...fade}
        style={[
          styles.stack,
          { top: mapTop + mapChrome.inset, right: insets.right + mapChrome.inset },
          fade.style,
        ]}
      >
        <MapControls
          onLayers={() => setPanel('layers')}
          onCenterOnMe={() => void centerOnMe()}
          bearing={view.bearing}
          onNorthUp={() =>
            cameraRef.current?.easeTo({ center: [view.center.lon, view.center.lat], bearing: 0 })
          }
        />
      </Animated.View>

      <Animated.View
        testID="map-chrome-footer"
        {...fade}
        pointerEvents="none"
        style={[
          styles.footer,
          {
            left: insets.left + mapChrome.inset,
            right: insets.right + mapChrome.inset,
            bottom: peekHeight + FOOTER_ABOVE_PEEK,
          },
          fade.style,
        ]}
      >
        <MapFooter
          lat={view.center.lat}
          zoom={view.zoom}
          credit={BASEMAPS[baseOf(basemap)].credit}
        />
      </Animated.View>

      {current && radio ? (
        <MapBottomSheet
          {...sheetCommon}
          state="checkedIn"
          place={placeOf(current.placement, names)}
          checkedInAt={current.checkedInAt}
          onCheckOut={() => setPanel('checkOut')}
          onChangeSpot={() => router.navigate('/check-in')}
        />
      ) : (
        <MapBottomSheet
          {...sheetCommon}
          state="notCheckedIn"
          onCheckIn={() => router.navigate('/check-in')}
        />
      )}

      <LayersSheet
        visible={panel === 'layers'}
        basemap={basemap}
        layers={layers}
        onLayerChange={(layer, on) => setLayers((shown) => ({ ...shown, [layer]: on }))}
        available={MAP_LAYER_IDS.filter((id) => id !== 'areas' || hasAreas)}
        {...(property ? { onFitProperty: fitProperty } : {})}
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
  // Clips the sheet where it slides below the tab bar's edge.
  root: { flex: 1, backgroundColor: theme.colors.plate, overflow: 'hidden' },
  map: { flex: 1 },
  pill: { position: 'absolute' },
  stack: { position: 'absolute' },
  footer: { position: 'absolute', alignItems: 'flex-start' },
}));
