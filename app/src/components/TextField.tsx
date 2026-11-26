import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { colors, radii, sizes, spacing, textStyles } from '../theme';

/** One-line text field. The placeholder doubles as the spoken label. */
export function TextField({
  placeholder,
  style,
  ...props
}: TextInputProps & { placeholder: string }) {
  return (
    <TextInput
      accessibilityLabel={placeholder}
      placeholder={placeholder}
      placeholderTextColor={colors.textSecondary}
      style={[styles.input, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    ...textStyles.body,
    color: colors.text,
    minHeight: sizes.minTapTarget,
    borderRadius: radii.primaryButton,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.md,
  },
});
