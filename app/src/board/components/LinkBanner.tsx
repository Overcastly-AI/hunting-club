import { StyleSheet, Text, View } from 'react-native';

import { MESH_TONE_COLOR, type MeshTone } from '../../map/meshStatus';
import { colors, radii, sizes, spacing, textStyles } from '../../theme';

/** The board radio's link, big enough to read from across the room. */
export function LinkBanner({ text, tone }: { text: string; tone: MeshTone }) {
  return (
    <View
      accessible
      accessibilityLabel={text}
      accessibilityLiveRegion={tone === 'ok' ? 'none' : 'polite'}
      style={[styles.banner, tone !== 'ok' && styles.warning]}
    >
      <View style={[styles.dot, { backgroundColor: MESH_TONE_COLOR[tone] }]} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const DOT_SIZE = 20;

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.control,
    paddingHorizontal: spacing.md,
    borderRadius: radii.control,
    backgroundColor: colors.surfaceRaised,
  },
  /** Link down or mesh quiet: gold outline, never red. */
  warning: { borderWidth: sizes.hairline, borderColor: colors.help },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
  text: { ...textStyles.boardDetail, color: colors.text, flexShrink: 1 },
});
