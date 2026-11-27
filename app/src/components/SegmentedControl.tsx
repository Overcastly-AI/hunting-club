import { Pressable, Text, View } from 'react-native';

import { makeStyles, radii, sizes, spacing, textStyles } from '../theme';

type Props<T extends string> = {
  segments: readonly T[];
  labels: Record<T, string>;
  selected: T;
  onSelect: (segment: T) => void;
};

/**
 * Segmented control (docs/DESIGN.md, the chat's Whole club / Party / Direct): segments in one
 * bordered control, divided by its edge. The selected segment is inverted, plate on ink, so
 * orange stays for you, the main action and the selected map item.
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
      {segments.map((segment, index) => {
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
              index > 0 && styles.divided,
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
    borderWidth: sizes.controlBorder,
    borderColor: theme.colors.borderControl,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    minHeight: sizes.minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  divided: { borderLeftWidth: sizes.controlBorder, borderColor: theme.colors.borderControl },
  pressed: { backgroundColor: theme.colors.raised },
  selected: { backgroundColor: theme.colors.text },
  label: { ...textStyles.label, color: theme.colors.textSecondary, textAlign: 'center' },
  selectedLabel: { color: theme.colors.plate },
}));
