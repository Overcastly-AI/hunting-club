import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, opacity, radii, sizes, spacing, textStyles } from '../theme';

type Props<T extends string> = {
  segments: readonly T[];
  labels: Record<T, string>;
  selected: T;
  onSelect: (segment: T) => void;
};

/** Rounded-rectangle segments (no pills, no orange): selected is raised with a white outline. */
export function SegmentedControl<T extends string>({
  segments,
  labels,
  selected,
  onSelect,
}: Props<T>) {
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
              pressed && { opacity: opacity.pressed },
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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs, backgroundColor: colors.surface },
  segment: {
    flex: 1,
    minHeight: sizes.minTapTarget,
    borderRadius: radii.primaryButton,
    borderWidth: sizes.hairline,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  selected: { backgroundColor: colors.surfaceRaised, borderColor: colors.text },
  label: { ...textStyles.label, color: colors.textSecondary },
  selectedLabel: { color: colors.text },
});
