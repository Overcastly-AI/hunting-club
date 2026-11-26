import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, opacity, radii, sizes, spacing, textStyles } from '../theme';

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
            (pressed || disabled) && { opacity: opacity.pressed },
          ]}
        >
          <Text style={styles.text}>{option}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    minHeight: sizes.minTapTarget,
    borderRadius: radii.primaryButton,
    borderWidth: sizes.hairline,
    borderColor: colors.surfaceRaised,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  selected: { borderColor: colors.text },
  text: { ...textStyles.label, color: colors.text },
});
