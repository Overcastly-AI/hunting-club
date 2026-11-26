import { TextInput, type TextInputProps } from 'react-native';

import { makeStyles, radii, sizes, spacing, textStyles, useTheme } from '../theme';

/** One-line text field. The placeholder doubles as the spoken label. */
export function TextField({
  placeholder,
  style,
  ...props
}: TextInputProps & { placeholder: string }) {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <TextInput
      accessibilityLabel={placeholder}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textSecondary}
      style={[styles.input, style]}
      {...props}
    />
  );
}

const useStyles = makeStyles((theme) => ({
  input: {
    ...textStyles.body,
    color: theme.colors.text,
    minHeight: sizes.minTapTarget,
    borderRadius: radii.primaryButton,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.surface2,
    paddingHorizontal: spacing.md,
  },
}));
