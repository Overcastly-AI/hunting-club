import { StyleSheet, View } from 'react-native';

import { colors, mapTextHalo, sizes, spacing } from '../../theme';
import { scaleBar } from '../geo';
import { HaloText } from './HaloText';

/** Distance scale for the current view; 500 ft at hunting zooms. */
export function ScaleBar({ lat, zoom }: { lat: number; zoom: number }) {
  const { width, label } = scaleBar(lat, zoom);
  return (
    <View accessible accessibilityLabel={`Scale: bar is ${label}`} style={styles.container}>
      <HaloText>{label}</HaloText>
      <View style={[styles.bar, { width }]}>
        <View style={[styles.tick, styles.left]} />
        <View style={[styles.tick, styles.right]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
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
});
