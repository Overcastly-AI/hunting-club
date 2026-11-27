import { Camera, Map } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useNow } from '../../hooks/useNow';
import { useIncomingAlerts } from '../../safety/hooks';
import { makeStyles, radii, spacing, textStyles } from '../../theme';
import { CONTINENTAL_US_VIEW, basemapStyle, DEFAULT_BASEMAP } from '../basemaps';
import { useMapData, type MapDataSource } from '../dataSource';
import { useFramedBounds } from '../useFramedBounds';
import { MAP_CHROME_OFF, MapLayers } from './MapLayers';

/** "5 out now. Tap to see the map." over the chat's strip of map. */
export function outNowCaption(count: number): string {
  return `${count === 0 ? 'Nobody' : count} out now. Tap to see the map.`;
}

/** Room around the outermost markers. */
const PADDING = { top: spacing.lg, bottom: spacing.lg, left: spacing.xl, right: spacing.xl };

type Props = {
  /** How tall the strip is at least (it grows with the caption at large text sizes). */
  height: number;
  /** The chat's strip: rings only, a caption, and a tap opens the map. */
  onPress?: () => void;
  dataSource?: MapDataSource;
};

/**
 * A strip of the live map above another screen (docs/DESIGN.md: "A strip of the map now sits
 * above [chat], so a message and a position are read together"; the peek above Check In).
 * Framed around everyone out; it does not pan or zoom. Offline like the map: the same tiles.
 */
export function MapStrip({ height, onPress, dataSource }: Props) {
  const styles = useStyles();
  const data = useMapData(dataSource);
  const alerts = useIncomingAlerts();
  const now = useNow();
  const mapStyle = useMemo(() => basemapStyle(DEFAULT_BASEMAP), []);
  const bounds = useFramedBounds(data.hunters.map((h) => h.position));
  const compact = !!onPress;

  const map = (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={mapStyle}
      {...MAP_CHROME_OFF}
      dragPan={false}
      touchZoom={false}
      touchRotate={false}
      touchPitch={false}
    >
      {bounds ? (
        <Camera bounds={bounds} padding={PADDING} />
      ) : (
        <Camera initialViewState={CONTINENTAL_US_VIEW} />
      )}
      <MapLayers data={data} alerts={alerts} now={now} compact={compact} />
    </Map>
  );

  if (!onPress) {
    return <View style={[styles.strip, { minHeight: height }]}>{map}</View>;
  }
  const caption = outNowCaption(data.hunters.length);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={caption}
      onPress={onPress}
      style={[styles.strip, { minHeight: height }]}
    >
      {map}
      <View style={styles.caption}>
        <Text style={styles.captionText}>{caption}</Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((theme) => ({
  strip: { justifyContent: 'flex-end', overflow: 'hidden', backgroundColor: theme.colors.canvas },
  caption: {
    alignSelf: 'flex-start',
    margin: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.markerPlate,
    backgroundColor: theme.colors.plate,
  },
  captionText: { ...textStyles.badge, color: theme.colors.text },
}));
