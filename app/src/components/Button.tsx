import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import {
  BUTTON_HEIGHT,
  BUTTON_PADDING,
  ICON_SIZE,
  makeStyles,
  radii,
  sizes,
  spacing,
  textStyles,
  useTheme,
  type ThemeColorToken,
} from '../theme';

/**
 * The same variants as the club admin's Button (docs/UI_REDESIGN.md section 6):
 * - primary: accent fill, the one main action of a screen.
 * - secondary: raised, with a subtle edge.
 * - tertiary: text only.
 * - danger: outline, for removing something.
 * - help: gold outline, for Ask for a Hand only (app only). It is never red and never
 *   reads like an emergency call: it pings the hunter's party or club.
 */
export const BUTTON_VARIANTS = ['primary', 'secondary', 'tertiary', 'danger', 'help'] as const;
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];

/**
 * md 48 (default) and lg 56, as on the web. `hero` (62 px, the old primary height) is
 * only for Check Out and Ask for a Hand on the map, where a gloved thumb must hit it.
 */
export type AppButtonSize = 'md' | 'lg' | 'hero';

const HEIGHT: Record<AppButtonSize, number> = {
  md: BUTTON_HEIGHT.md,
  lg: BUTTON_HEIGHT.lg,
  hero: sizes.primaryButtonMinHeight,
};
const PADDING: Record<AppButtonSize, number> = {
  md: BUTTON_PADDING.md,
  lg: BUTTON_PADDING.lg,
  hero: BUTTON_PADDING.lg,
};

type Props = {
  label: string;
  /** Second line under the label, for example "Pings your party". Spoken after the label. */
  detail?: string;
  variant?: ButtonVariant;
  size?: AppButtonSize;
  /** Leading Lucide icon, drawn at 20 px in the label colour. */
  icon?: LucideIcon;
  onPress: () => void;
  disabled?: boolean;
  /** A spinner beside the label; presses are ignored and screen readers hear "busy". */
  loading?: boolean;
  accessibilityHint?: string;
};

/** Label colour token per variant (and when disabled). */
const LABEL: Record<ButtonVariant | 'disabled', ThemeColorToken> = {
  primary: 'onAccent',
  secondary: 'text',
  tertiary: 'text',
  danger: 'danger',
  help: 'warning',
  disabled: 'textTertiary',
};

export function Button({
  label,
  detail,
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  onPress,
  disabled,
  loading,
  accessibilityHint,
}: Props) {
  const styles = useStyles();
  const theme = useTheme();
  const inactive = !!disabled || !!loading;
  const textStyle = disabled ? styles.disabledText : styles[`${variant}Text`];
  const color = theme.colors[LABEL[disabled ? 'disabled' : variant]];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { minHeight: HEIGHT[size], paddingHorizontal: PADDING[size] },
        styles[variant],
        pressed && styles[`${variant}Pressed`],
        disabled && (variant === 'tertiary' ? styles.disabledQuiet : styles.disabled),
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : Icon ? (
        <Icon
          size={ICON_SIZE.md}
          color={color}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
      <View style={styles.texts}>
        <Text style={[styles.label, textStyle]}>{label}</Text>
        {detail ? <Text style={[styles.detail, textStyle]}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((theme) => ({
  base: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  texts: { alignItems: 'center', flexShrink: 1 },
  label: { ...textStyles.label, textAlign: 'center' },
  detail: { ...textStyles.body, textAlign: 'center' },

  primary: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accentBorder },
  primaryPressed: { backgroundColor: theme.colors.accentHover },
  primaryText: { color: theme.colors.onAccent },

  secondary: { backgroundColor: theme.colors.surface2, borderColor: theme.colors.borderSubtle },
  secondaryPressed: { backgroundColor: theme.colors.surface3 },
  secondaryText: { color: theme.colors.text },

  tertiary: { backgroundColor: 'transparent' },
  tertiaryPressed: { backgroundColor: theme.colors.surface2 },
  tertiaryText: { color: theme.colors.text },

  danger: { backgroundColor: 'transparent', borderColor: theme.colors.danger },
  dangerPressed: { backgroundColor: theme.colors.dangerTint },
  dangerText: { color: theme.colors.danger },

  help: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.warning,
    borderWidth: sizes.hairline,
  },
  helpPressed: { backgroundColor: theme.colors.warningTint },
  helpText: { color: theme.colors.warning },

  // Disabled is its own look, not a faded one, so its text keeps 4.5:1 in both themes.
  disabled: { backgroundColor: theme.colors.surface2, borderColor: theme.colors.borderSubtle },
  disabledQuiet: { backgroundColor: 'transparent', borderColor: 'transparent' },
  disabledText: { color: theme.colors.textTertiary },
}));
