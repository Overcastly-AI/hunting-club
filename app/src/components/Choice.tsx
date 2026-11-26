import { Pressable, Text, View } from 'react-native';

import { makeStyles, radii, sizes, spacing, textStyles } from '../theme';

type Props = {
  label: string;
  detail?: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
};

/** One option in a list of choices (radio-button style). Selection is shown with a white outline and the word "Selected", not orange. */
export function Choice({ label, detail, selected, disabled, onPress }: Props) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: !!disabled }}
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.selected,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.texts}>
        <Text style={[styles.label, disabled && styles.disabledText]}>{label}</Text>
        {detail ? (
          <Text style={[styles.detail, disabled && styles.disabledText]}>{detail}</Text>
        ) : null}
      </View>
      {selected ? <Text style={styles.detail}>Selected</Text> : null}
    </Pressable>
  );
}

const useStyles = makeStyles((theme) => ({
  choice: {
    minHeight: sizes.primaryButtonMinHeight,
    borderRadius: radii.primaryButton,
    borderWidth: sizes.hairline,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.surface2,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selected: { borderColor: theme.colors.text },
  pressed: { backgroundColor: theme.colors.surface3 },
  // Disabled is its own look (tertiary text), not a fade, so it keeps 4.5:1 in both themes.
  disabled: { backgroundColor: theme.colors.surface1 },
  disabledText: { color: theme.colors.textTertiary },
  texts: { flex: 1, paddingVertical: spacing.sm },
  label: { ...textStyles.label, color: theme.colors.text },
  detail: { ...textStyles.body, color: theme.colors.textSecondary },
}));
