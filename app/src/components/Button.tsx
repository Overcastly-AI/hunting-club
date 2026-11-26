import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { makeStyles, opacity, radii, sizes, spacing, textStyles } from '../theme';

/**
 * - primary: orange, for the one main action on a screen.
 * - secondary: raised dark button.
 * - help: gold outline, for Ask for a Hand only.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'help';

type Props = {
  label: string;
  /** Second line under the label, for example "Pings your party". */
  detail?: string;
  variant?: ButtonVariant;
  onPress: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
  icon?: ReactNode;
};

export function Button({
  label,
  detail,
  variant = 'secondary',
  onPress,
  disabled,
  accessibilityHint,
  icon,
}: Props) {
  const styles = useStyles();
  const variantStyle = styles[variant];
  const textColor =
    variant === 'primary'
      ? styles.primaryText
      : variant === 'help'
        ? styles.helpText
        : styles.secondaryText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variantStyle,
        (pressed || disabled) && { opacity: opacity.pressed },
      ]}
    >
      {icon}
      <View style={styles.texts}>
        <Text style={[styles.label, textColor]}>{label}</Text>
        {detail ? <Text style={[styles.detail, textColor]}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((theme) => ({
  base: {
    minHeight: sizes.primaryButtonMinHeight,
    borderRadius: radii.primaryButton,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  texts: { alignItems: 'center' },
  primary: { backgroundColor: theme.colors.accent },
  secondary: { backgroundColor: theme.colors.surface2 },
  help: {
    borderWidth: sizes.hairline,
    borderColor: theme.colors.warning,
    backgroundColor: theme.colors.surface0,
  },
  label: { ...textStyles.label, fontSize: textStyles.bodyLarge.fontSize },
  detail: { ...textStyles.body },
  primaryText: { color: theme.colors.onAccent },
  secondaryText: { color: theme.colors.text },
  helpText: { color: theme.colors.warning },
}));
