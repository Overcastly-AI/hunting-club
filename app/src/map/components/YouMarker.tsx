import { GeoJSONSource, Layer, Marker } from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

import { colors, opacity, sizes } from '../../theme';
import { scentConeRing, scentLabelPosition } from '../geo';
import { YOUR_SCENT, yourAccessibilityLabel } from '../labels';
import type { LatLon } from '@huntclub/mesh';
import { HaloText } from './HaloText';

type Props = {
  position: LatLon;
  /** Where the wind blows from, in degrees. No cone until wind is known. */
  windFromDeg?: number;
};

const PULSE_MS = 1800;

/** Your orange dot with a pulse, and your scent cone pointing downwind. */
export function YouMarker({ position, windFromDeg }: Props) {
  const showScent = windFromDeg !== undefined;
  return (
    <>
      {showScent ? <ScentCone position={position} windFromDeg={windFromDeg} /> : null}
      <Marker id="you" lngLat={[position.lon, position.lat]} anchor="center">
        <View accessible accessibilityLabel={yourAccessibilityLabel(showScent)} style={styles.box}>
          <Pulse />
          <View style={styles.dot} />
        </View>
      </Marker>
    </>
  );
}

function ScentCone({ position, windFromDeg }: { position: LatLon; windFromDeg: number }) {
  const cone = useMemo<GeoJSON.Feature<GeoJSON.Polygon>>(
    () => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [scentConeRing(position, windFromDeg)] },
    }),
    [position, windFromDeg],
  );
  const label = scentLabelPosition(position, windFromDeg);
  return (
    <>
      <GeoJSONSource id="your-scent" data={cone}>
        <Layer
          id="your-scent-fill"
          type="fill"
          paint={{ 'fill-color': colors.accent, 'fill-opacity': opacity.scentFill }}
        />
        <Layer
          id="your-scent-line"
          type="line"
          paint={{
            'line-color': colors.accent,
            'line-opacity': opacity.scentLine,
            'line-width': sizes.hairline,
          }}
        />
      </GeoJSONSource>
      <Marker id="your-scent-label" lngLat={[label.lon, label.lat]} anchor="center">
        <HaloText importantForAccessibility="no" accessibilityElementsHidden>
          {YOUR_SCENT}
        </HaloText>
      </Marker>
    </>
  );
}

function Pulse() {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return;
      loop = Animated.loop(
        Animated.timing(progress, {
          toValue: 1,
          duration: PULSE_MS,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [progress]);
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [sizes.youDot / sizes.youPulse, 1],
  });
  const fade = progress.interpolate({ inputRange: [0, 1], outputRange: [opacity.scentLine, 0] });
  return <Animated.View style={[styles.pulse, { opacity: fade, transform: [{ scale }] }]} />;
}

const styles = StyleSheet.create({
  box: {
    width: sizes.youPulse,
    height: sizes.youPulse,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    width: sizes.youPulse,
    height: sizes.youPulse,
    borderRadius: sizes.youPulse / 2,
    backgroundColor: colors.accent,
  },
  dot: {
    width: sizes.youDot,
    height: sizes.youDot,
    borderRadius: sizes.youDot / 2,
    backgroundColor: colors.accent,
    borderWidth: sizes.hairline,
    borderColor: colors.text,
  },
});
