import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { colors, radii, sizes, spacing, textStyles } from '../theme';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  /** `primary` is orange: use it only for the screen's main action. */
  variant?: 'primary' | 'secondary';
};

/** Word-labelled button; at least 48 px tall (primary: 62 px). */
export function Button({ label, variant = 'secondary', disabled, ...rest }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.secondary,
        (pressed || disabled) && styles.dimmed,
      ]}
      {...rest}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: sizes.minTapTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radii.primaryButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    minHeight: sizes.primaryButtonMinHeight,
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dimmed: {
    opacity: 0.6,
  },
  label: {
    ...textStyles.label,
    color: colors.text,
  },
});
