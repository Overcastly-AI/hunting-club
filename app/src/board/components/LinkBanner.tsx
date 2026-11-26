import { Text, View } from 'react-native';

import { MESH_TONE_COLOR, type MeshTone } from '../../map/meshStatus';
import { makeStyles, useTheme, radii, sizes, spacing, textStyles } from '../../theme';

/** The board radio's link, big enough to read from across the room. */
export function LinkBanner({ text, tone }: { text: string; tone: MeshTone }) {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <View
      accessible
      accessibilityLabel={text}
      accessibilityLiveRegion={tone === 'ok' ? 'none' : 'polite'}
      style={[styles.banner, tone !== 'ok' && styles.warning]}
    >
      <View style={[styles.dot, { backgroundColor: theme.colors[MESH_TONE_COLOR[tone]] }]} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const DOT_SIZE = 20;

const useStyles = makeStyles((theme) => ({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.control,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.surface1,
  },
  /** Link down or mesh quiet: gold outline, never red. */
  warning: { borderWidth: sizes.hairline, borderColor: theme.colors.warning },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
  text: { ...textStyles.boardDetail, color: theme.colors.text, flexShrink: 1 },
}));
