import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, opacity, radii, sizes, spacing, textStyles } from '../../theme';
import { describeMeshStatus, type MeshTone } from '../meshStatus';
import type { MeshStatus } from '../types';

type Props = { status: MeshStatus; now: number; onPress: () => void };

const DOT_COLOR: Record<MeshTone, string> = {
  ok: colors.fresh,
  quiet: colors.help,
  none: colors.textSecondary,
};

/** "Mesh: 3 radios · heard 12s ago". Tapping it opens radio details. */
export function MeshStatusLine({ status, now, onPress }: Props) {
  const { text, tone } = describeMeshStatus(status, now);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityHint="Opens radio details"
      onPress={onPress}
      style={({ pressed }) => [styles.line, pressed && { opacity: opacity.pressed }]}
    >
      <View style={[styles.dot, { backgroundColor: DOT_COLOR[tone] }]} />
      <Text style={styles.text} numberOfLines={1}>
        {text}
      </Text>
    </Pressable>
  );
}

const DOT = 10;

const styles = StyleSheet.create({
  line: {
    alignSelf: 'flex-start',
    minHeight: sizes.minTapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.control,
    paddingHorizontal: spacing.md,
  },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  text: { ...textStyles.body, color: colors.text },
});
