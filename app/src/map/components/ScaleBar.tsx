import { StyleSheet, View } from 'react-native';

import { colors, mapTextHalo, sizes, spacing, textStyles } from '../../theme';
import { scaleBar } from '../geo';
import { HaloText } from './HaloText';

/** The gap between the bar and its length. */
export const SCALE_LABEL_GAP = spacing.xs;

/** Distance scale for the current view, its length beside it on one line; 500 ft at hunting zooms. */
export function ScaleBar({ lat, zoom }: { lat: number; zoom: number }) {
  const { width, label } = scaleBar(lat, zoom);
  return (
    <View accessible accessibilityLabel={`Scale: bar is ${label}`} style={styles.container}>
      <View style={[styles.bar, { width }]}>
        <View style={[styles.tick, styles.left]} />
        <View style={[styles.tick, styles.right]} />
      </View>
      <HaloText style={styles.label}>{label}</HaloText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', gap: SCALE_LABEL_GAP },
  bar: {
    height: sizes.scaleBarTick,
    borderBottomWidth: sizes.hairline,
    borderColor: colors.text,
    shadowColor: mapTextHalo.textShadowColor,
    shadowOpacity: 1,
    shadowRadius: sizes.mapHaloWidth,
    shadowOffset: { width: 0, height: 0 },
  },
  tick: {
    position: 'absolute',
    bottom: 0,
    width: sizes.hairline,
    height: sizes.scaleBarTick,
    backgroundColor: colors.text,
  },
  left: { left: 0 },
  right: { right: 0 },
  label: textStyles.markerDetail,
});
