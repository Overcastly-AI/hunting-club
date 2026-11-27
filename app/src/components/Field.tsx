import { CircleAlert } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { useAnnounce } from './announce';
import { ICON_SIZE, makeStyles, radii, sizes, spacing, textStyles, useTheme } from '../theme';

type Props = Omit<TextInputProps, 'accessibilityLabel' | 'placeholderTextColor'> & {
  /** Always the spoken label; shown above the field unless `hideLabel` (the chat composer). */
  label: string;
  /** Caption under the field, for example "Optional". */
  hint?: string;
  /** Shown with an icon in place of the hint, and announced. */
  error?: string;
  /** Keeps the label for screen readers but does not draw it (the field's own placeholder says it). */
  hideLabel?: boolean;
  /** Drawn inside the box at the end of the text, for example the chat's "0 of 200" counter. */
  trailing?: ReactNode;
};

/**
 * Field, as on the club admin (docs/UI_REDESIGN.md section 6): label (label style), a 48 px
 * input with a control-coloured edge that turns into a 2 px accent edge on focus, a hint
 * (caption) and an error (danger icon and text).
 */
export function Field({
  label,
  hint,
  error,
  hideLabel,
  trailing,
  style,
  onFocus,
  onBlur,
  ...input
}: Props) {
  const styles = useStyles();
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const described = [hint, error].filter(Boolean).join('. ');
  useAnnounce(error);
  // The box: a control edge, a 2 px accent edge while typing, the danger edge on an error.
  const box = [
    styles.box,
    error ? styles.invalid : null,
    focused ? styles.focused : null,
    input.editable === false ? styles.disabled : null,
  ];
  const textInput = (
    <TextInput
      accessibilityLabel={label}
      accessibilityHint={described || undefined}
      placeholderTextColor={theme.colors.textTertiary}
      // iOS draws its keyboard to match the app's theme, not only the phone's (Android's
      // keyboard follows the phone and ignores this).
      keyboardAppearance={theme.colorScheme}
      style={[
        styles.input,
        input.editable === false ? styles.disabledText : null,
        trailing ? styles.inRow : [box, style],
      ]}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      {...input}
    />
  );
  return (
    <View style={styles.field}>
      {hideLabel ? null : (
        <Text style={styles.label} importantForAccessibility="no" accessibilityElementsHidden>
          {label}
        </Text>
      )}
      {trailing ? (
        <View style={[box, styles.row]}>
          {textInput}
          {trailing}
        </View>
      ) : (
        textInput
      )}
      {error ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <CircleAlert
            size={ICON_SIZE.sm}
            color={theme.colors.danger}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const FOCUS_BORDER = sizes.hairline;

const useStyles = makeStyles((theme) => ({
  field: { gap: spacing.sm },
  label: { ...textStyles.label, color: theme.colors.text },
  // Text fields sit in the page's deepest tone (the direction's pit) with a control edge.
  input: { ...textStyles.body, color: theme.colors.text },
  box: {
    minHeight: sizes.minTapTarget,
    borderRadius: radii.md,
    borderWidth: sizes.controlBorder,
    borderColor: theme.colors.borderControl,
    backgroundColor: theme.colors.canvas,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  // A 2 px edge with less padding, so the text does not move.
  focused: {
    borderWidth: FOCUS_BORDER,
    borderColor: theme.colors.accent,
    paddingHorizontal: spacing.md - (FOCUS_BORDER - sizes.controlBorder),
  },
  // With something at the end of the box: the box is a row and the text field fills it.
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inRow: { flex: 1, paddingVertical: 0 },
  invalid: { borderColor: theme.colors.danger },
  disabled: { backgroundColor: theme.colors.plate, borderColor: theme.colors.borderSubtle },
  disabledText: { color: theme.colors.textTertiary },
  hint: { ...textStyles.caption, color: theme.colors.textTertiary, marginTop: -spacing.xs },
  errorRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' },
  error: { ...textStyles.badge, color: theme.colors.danger, flexShrink: 1 },
}));
