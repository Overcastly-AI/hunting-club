import { mapChrome } from '@huntclub/design';
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
 * The same variants as the club admin's Button (docs/DESIGN.md, map-first):
 * - primary: accent fill with near-black text, the one main action of a screen.
 * - secondary: raised, with a 1.5 px control edge.
 * - tertiary: text only.
 * - danger: outline, for removing something.
 * - help: gold on its gold wash, for Ask for a Hand only (app only). It is never red and never
 *   reads like an emergency call: it pings the hunter's party or club.
 */
export const BUTTON_VARIANTS = ['primary', 'secondary', 'tertiary', 'danger', 'help'] as const;
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];

/**
 * md (default) and lg, as on the web. `sheet` (56 px, mapChrome.sheet.actionRow) is only for
 * the map sheet's action row: Check In or Check Out, and the 56 by 56 Ask for a Hand.
 */
export type AppButtonSize = 'md' | 'lg' | 'sheet';

const HEIGHT: Record<AppButtonSize, number> = {
  md: BUTTON_HEIGHT.md,
  lg: BUTTON_HEIGHT.lg,
  sheet: mapChrome.sheet.actionRow,
};
const PADDING: Record<AppButtonSize, number> = {
  md: BUTTON_PADDING.md,
  lg: BUTTON_PADDING.lg,
  sheet: BUTTON_PADDING.md,
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
  /**
   * A square of the size's height with the icon only (the map's 56 by 56 Ask for a Hand). The
   * label and detail are still spoken; give an icon.
   */
  iconOnly?: boolean;
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
  iconOnly,
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
        iconOnly
          ? { width: HEIGHT[size], height: HEIGHT[size], paddingHorizontal: 0 }
          : { minHeight: HEIGHT[size], paddingHorizontal: PADDING[size] },
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
      {iconOnly ? null : (
        <View style={styles.texts}>
          <Text style={[styles.label, textStyle]}>{label}</Text>
          {detail ? (
            <Text
              style={[
                styles.detail,
                textStyle,
                variant === 'help' && !disabled && styles.helpDetail,
              ]}
            >
              {detail}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((theme) => ({
  base: {
    borderRadius: radii.md,
    borderWidth: sizes.controlBorder,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  texts: { alignItems: 'center', flexShrink: 1 },
  label: { ...textStyles.button, textAlign: 'center' },
  // A second line in a button is a sheet's second line: 14 px.
  detail: { ...textStyles.caption, textAlign: 'center' },

  primary: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accentBorder },
  primaryPressed: { backgroundColor: theme.colors.accentHover },
  primaryText: { color: theme.colors.onAccent },

  secondary: { backgroundColor: theme.colors.raised, borderColor: theme.colors.borderControl },
  secondaryPressed: { backgroundColor: theme.colors.pressed },
  secondaryText: { color: theme.colors.text },

  tertiary: { backgroundColor: 'transparent' },
  tertiaryPressed: { backgroundColor: theme.colors.raised },
  tertiaryText: { color: theme.colors.text },

  danger: { backgroundColor: 'transparent', borderColor: theme.colors.danger },
  dangerPressed: { backgroundColor: theme.colors.dangerTint },
  dangerText: { color: theme.colors.danger },

  // Ask for a Hand: gold on its dark gold wash, with who it pings in ink underneath.
  help: {
    backgroundColor: theme.colors.warningTint,
    borderColor: theme.colors.warning,
    borderWidth: sizes.selectedBorder,
  },
  helpPressed: { backgroundColor: theme.colors.pressed },
  helpText: { color: theme.colors.warning },
  helpDetail: { color: theme.colors.text },

  // Disabled is its own look, not a faded one, so its text keeps 4.5:1 in both themes.
  disabled: { backgroundColor: theme.colors.raised, borderColor: theme.colors.borderSubtle },
  disabledQuiet: { backgroundColor: 'transparent', borderColor: 'transparent' },
  disabledText: { color: theme.colors.textTertiary },
}));
