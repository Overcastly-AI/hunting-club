import { CircleAlert } from 'lucide-react-native';
import { useState } from 'react';
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
};

/**
 * Field, as on the club admin (docs/UI_REDESIGN.md section 6): label (label style), a 48 px
 * input with a control-coloured edge that turns into a 2 px accent edge on focus, a hint
 * (caption) and an error (danger icon and text).
 */
export function Field({ label, hint, error, hideLabel, style, onFocus, onBlur, ...input }: Props) {
  const styles = useStyles();
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const described = [hint, error].filter(Boolean).join('. ');
  useAnnounce(error);
  return (
    <View style={styles.field}>
      {hideLabel ? null : (
        <Text style={styles.label} importantForAccessibility="no" accessibilityElementsHidden>
          {label}
        </Text>
      )}
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={described || undefined}
        placeholderTextColor={theme.colors.textTertiary}
        style={[
          styles.input,
          error ? styles.invalid : null,
          focused ? styles.focused : null,
          input.editable === false ? styles.disabled : null,
          style,
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
  input: {
    ...textStyles.body,
    color: theme.colors.text,
    minHeight: sizes.minTapTarget,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.colors.borderControl,
    backgroundColor: theme.colors.surface2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  // A 2 px edge with 1 px less padding, so the text does not move.
  focused: {
    borderWidth: FOCUS_BORDER,
    borderColor: theme.colors.accent,
    paddingHorizontal: spacing.md - (FOCUS_BORDER - 1),
  },
  invalid: { borderColor: theme.colors.danger },
  disabled: {
    backgroundColor: theme.colors.surface1,
    borderColor: theme.colors.borderSubtle,
    color: theme.colors.textTertiary,
  },
  hint: { ...textStyles.caption, color: theme.colors.textTertiary, marginTop: -spacing.xs },
  errorRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' },
  error: { ...textStyles.badge, color: theme.colors.danger, flexShrink: 1 },
}));
