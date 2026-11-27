import { Pressable, Text, View } from 'react-native';

import { makeStyles, useTheme, radii, sizes, spacing, textStyles } from '../../theme';
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
      style={({ pressed }) => [styles.line, pressed && styles.pressed, quiet && styles.banner]}
    >
      <View style={[styles.dot, { backgroundColor: theme.colors[MESH_TONE_COLOR[tone]] }]} />
      <View style={styles.texts}>
        <Text style={[styles.text, quiet && styles.quietText]} numberOfLines={1}>
          {text}
        </Text>
        {quiet ? <Text style={[styles.detail, styles.quietText]}>{MESH_QUIET_DETAIL}</Text> : null}
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
    backgroundColor: theme.colors.plate,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.colors.borderControl,
    paddingHorizontal: spacing.md,
  },
  pressed: { backgroundColor: theme.colors.raised },
  /**
   * Mesh down: a full-width warning banner (gold text on the warning tint, gold edge) so
   * nobody mistakes old positions for live ones.
   */
  banner: {
    alignSelf: 'stretch',
    borderWidth: sizes.hairline,
    borderColor: theme.colors.warning,
    backgroundColor: theme.colors.warningTint,
    paddingVertical: spacing.sm,
  },
  quietText: { color: theme.colors.warning },
  texts: { flexShrink: 1 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  detail: { ...textStyles.body, color: theme.colors.textSecondary },
  text: { ...textStyles.body, color: theme.colors.text },
}));
