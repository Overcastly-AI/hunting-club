import { Pressable, Text, View } from 'react-native';

import { makeStyles, radii, sizes, spacing, textStyles } from '../theme';

type Props<T extends string> = {
  segments: readonly T[];
  labels: Record<T, string>;
  selected: T;
  onSelect: (segment: T) => void;
};

/**
 * Segmented control, as on the club admin: segments in a bordered surface-2 tray; the
 * selected one is filled with the accent (orange is for the selected item).
 */
export function SegmentedControl<T extends string>({
  segments,
  labels,
  selected,
  onSelect,
}: Props<T>) {
  const styles = useStyles();
  return (
    <View accessibilityRole="tablist" style={styles.row}>
      {segments.map((segment) => {
        const isSelected = segment === selected;
        return (
          <Pressable
            key={segment}
            accessibilityRole="tab"
            accessibilityLabel={labels[segment]}
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(segment)}
            style={({ pressed }) => [
              styles.segment,
              isSelected && styles.selected,
              pressed && !isSelected && styles.pressed,
            ]}
          >
            <Text style={[styles.label, isSelected && styles.selectedLabel]}>
              {labels[segment]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.borderControl,
    borderRadius: radii.md,
    backgroundColor: theme.colors.surface2,
  },
  segment: {
    flex: 1,
    minHeight: sizes.minTapTarget,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  pressed: { backgroundColor: theme.colors.surface3 },
  selected: { backgroundColor: theme.colors.accent },
  label: { ...textStyles.label, color: theme.colors.textSecondary, textAlign: 'center' },
  selectedLabel: { color: theme.colors.onAccent },
}));
