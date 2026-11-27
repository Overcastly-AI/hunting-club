import type { LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { ICON_SIZE, makeStyles, radii, sizes, spacing, textStyles, useTheme } from '../theme';
import { RadioMark } from './RadioMark';
import { SelectedOutline, useSelectedStyles } from './SelectedOutline';

type Props = {
  label: string;
  detail?: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  /** A leading icon: the check-in modes (a stand, an area, a pin, a walker). */
  icon?: LucideIcon;
  /**
   * `row` (default): a full-width row with the radio mark at the end, for lists of options.
   * `tile`: a square-ish button with the selected edge, for a grid (the check-in modes).
   */
  look?: 'row' | 'tile';
};

/**
 * One option in a pick-one group (accessibility role radio). The selected option has the
 * orange selected edge (orange's third job) and, as a row, a filled radio mark, so it is never
 * colour alone. Disabled is its own look, not a fade, so its text keeps 4.5:1.
 */
export function Choice({
  label,
  detail,
  selected,
  disabled,
  onPress,
  icon: Icon,
  look = 'row',
}: Props) {
  const styles = useStyles();
  const selectedStyles = useSelectedStyles();
  const theme = useTheme();
  const tile = look === 'tile';
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: !!disabled }}
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        tile && styles.tile,
        pressed && styles.pressed,
        disabled && styles.disabled,
        selected && selectedStyles.selectedEdge,
      ]}
    >
      {Icon ? (
        <Icon
          size={ICON_SIZE.md}
          color={disabled ? theme.colors.textTertiary : theme.colors.text}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
      <View style={styles.texts}>
        <Text style={[styles.label, disabled && styles.disabledText]}>{label}</Text>
        {detail && !tile ? (
          <Text style={[styles.detail, disabled && styles.disabledText]}>{detail}</Text>
        ) : null}
      </View>
      {tile ? null : <RadioMark chosen={selected} />}
      {selected ? <SelectedOutline /> : null}
    </Pressable>
  );
}

const useStyles = makeStyles((theme) => ({
  choice: {
    minHeight: sizes.listRow,
    borderRadius: radii.md,
    borderWidth: sizes.controlBorder,
    borderColor: theme.colors.borderControl,
    backgroundColor: theme.colors.raised,
    paddingHorizontal: spacing.sm + spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs / 2,
  },
  tile: { minHeight: sizes.modeButton },
  pressed: { backgroundColor: theme.colors.pressed },
  disabled: { backgroundColor: theme.colors.plate, borderColor: theme.colors.borderSubtle },
  disabledText: { color: theme.colors.textTertiary },
  texts: { flex: 1, paddingVertical: spacing.sm },
  label: { ...textStyles.button, color: theme.colors.text },
  detail: { ...textStyles.caption, color: theme.colors.textSecondary },
}));
