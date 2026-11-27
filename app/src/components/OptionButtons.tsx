import { Pressable, Text, View } from 'react-native';

import { makeStyles, radii, sizes, spacing, textStyles } from '../theme';

type Props<T extends string> = {
  options: readonly T[];
  onPress: (option: T) => void;
  /** Spoken label; defaults to the option text. */
  accessibilityLabelFor?: (option: T) => string;
  /** Shows one option as selected (white outline), for pick-one rows. */
  selected?: T;
  disabled?: boolean;
  /** Two equal columns (the chat's quick replies) instead of a wrapping row. */
  grid?: boolean;
};

/**
 * A wrapping row (or a two-column grid) of squared buttons, never pills: quick replies,
 * species picks. The picked one has a 2 px ink edge.
 */
export function OptionButtons<T extends string>({
  options,
  onPress,
  accessibilityLabelFor,
  selected,
  disabled,
  grid,
}: Props<T>) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      {options.map((option) => (
        <Pressable
          key={option}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabelFor?.(option) ?? option}
          accessibilityState={{ disabled: !!disabled, selected: selected === option }}
          disabled={disabled}
          onPress={() => onPress(option)}
          style={({ pressed }) => [
            styles.option,
            grid && styles.half,
            selected === option && styles.selected,
            pressed && styles.pressed,
            disabled && styles.disabled,
          ]}
        >
          <Text style={[styles.text, disabled && styles.disabledText]}>{option}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    minHeight: sizes.minTapTarget,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.colors.borderControl,
    backgroundColor: theme.colors.raised,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
  },
  // Two per row: each takes half the row less half the gap.
  half: { flexGrow: 1, flexBasis: '40%', paddingHorizontal: spacing.sm },
  selected: { borderWidth: sizes.selectedBorder, borderColor: theme.colors.text },
  pressed: { backgroundColor: theme.colors.pressed },
  disabled: { backgroundColor: theme.colors.plate, borderColor: theme.colors.borderSubtle },
  disabledText: { color: theme.colors.textTertiary },
  text: { ...textStyles.button, color: theme.colors.text, textAlign: 'center' },
}));
