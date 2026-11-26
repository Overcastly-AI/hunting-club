import { Pressable, Text, View } from 'react-native';

import { makeStyles, useTheme, opacity, radii, sizes, spacing, textStyles } from '../../theme';
import { MESH_QUIET_DETAIL, MESH_TONE_COLOR, describeMeshStatus } from '../meshStatus';
import type { MeshStatus } from '../types';

type Props = { status: MeshStatus; now: number; onPress: () => void };

/** "Mesh: 3 radios · heard 12s ago". Tapping it opens radio details. */
export function MeshStatusLine({ status, now, onPress }: Props) {
  const theme = useTheme();
  const styles = useStyles();
  const { text, tone } = describeMeshStatus(status, now);
  const quiet = tone === 'quiet' && status.lastHeardAt !== null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={quiet ? `${text}. ${MESH_QUIET_DETAIL}` : text}
      accessibilityHint="Opens radio details"
      accessibilityLiveRegion={quiet ? 'polite' : 'none'}
      onPress={onPress}
      style={({ pressed }) => [
        styles.line,
        quiet && styles.banner,
        pressed && { opacity: opacity.pressed },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: theme.colors[MESH_TONE_COLOR[tone]] }]} />
      <View style={styles.texts}>
        <Text style={styles.text} numberOfLines={1}>
          {text}
        </Text>
        {quiet ? <Text style={styles.detail}>{MESH_QUIET_DETAIL}</Text> : null}
      </View>
    </Pressable>
  );
}

const DOT = 10;

const useStyles = makeStyles((theme) => ({
  line: {
    alignSelf: 'flex-start',
    minHeight: sizes.minTapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: theme.colors.surface0,
    borderRadius: radii.control,
    paddingHorizontal: spacing.md,
  },
  /** Mesh down: full width with a gold outline so nobody mistakes old positions for live ones. */
  banner: {
    alignSelf: 'stretch',
    borderWidth: sizes.hairline,
    borderColor: theme.colors.warning,
    paddingVertical: spacing.sm,
  },
  texts: { flexShrink: 1 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  detail: { ...textStyles.body, color: theme.colors.textSecondary },
  text: { ...textStyles.body, color: theme.colors.text },
}));
