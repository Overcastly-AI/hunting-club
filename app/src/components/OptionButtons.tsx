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
};

/** A wrapping row of rounded-rectangle buttons (never pills): quick replies, species picks. */
export function OptionButtons<T extends string>({
  options,
  onPress,
  accessibilityLabelFor,
  selected,
  disabled,
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
    borderRadius: radii.primaryButton,
    borderWidth: sizes.hairline,
    borderColor: theme.colors.raised,
    backgroundColor: theme.colors.raised,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  selected: { borderColor: theme.colors.text },
  pressed: { backgroundColor: theme.colors.pressed, borderColor: theme.colors.pressed },
  disabled: { backgroundColor: theme.colors.plate, borderColor: theme.colors.borderSubtle },
  disabledText: { color: theme.colors.textTertiary },
  text: { ...textStyles.label, color: theme.colors.text },
}));
