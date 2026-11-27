import type { LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { ICON_SIZE, makeStyles, radii, sizes, spacing, textStyles, useTheme } from '../theme';

type Props = {
  label: string;
  icon: LucideIcon;
  on: boolean;
  onChange: (on: boolean) => void;
};

/** The word beside the switch, so on and off are never shown by colour or position alone. */
export const SWITCH_WORDS = { on: 'On', off: 'Off' } as const;

/**
 * An on/off row (the map layers): icon, label, the word On or Off and a switch. "On" is ink,
 * not orange (docs/DESIGN.md: with five in a row, orange switches broke the three-jobs rule).
 */
export function ToggleRow({ label, icon: Icon, on, onChange }: Props) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      onPress={() => onChange(!on)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Icon
        size={ICON_SIZE.md}
        color={theme.colors.textSecondary}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.word, on && styles.wordOn]}>
        {on ? SWITCH_WORDS.on : SWITCH_WORDS.off}
      </Text>
      <View style={[styles.track, on && styles.trackOn]}>
        <View style={[styles.knob, on && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

const KNOB_INSET = (sizes.switchHeight - sizes.switchKnob) / 2 - sizes.controlBorder;

const useStyles = makeStyles((theme) => ({
  row: {
    minHeight: sizes.listRow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.xs / 2,
    borderTopWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  pressed: { backgroundColor: theme.colors.raised },
  label: { ...textStyles.label, color: theme.colors.text, flex: 1, paddingVertical: spacing.sm },
  word: { ...textStyles.badge, color: theme.colors.textSecondary },
  wordOn: { color: theme.colors.text },
  track: {
    width: sizes.switchWidth,
    height: sizes.switchHeight,
    borderRadius: radii.full,
    borderWidth: sizes.controlBorder,
    borderColor: theme.colors.borderControl,
    justifyContent: 'center',
    paddingHorizontal: KNOB_INSET,
  },
  trackOn: {
    backgroundColor: theme.colors.text,
    borderColor: theme.colors.text,
    alignItems: 'flex-end',
  },
  knob: {
    width: sizes.switchKnob,
    height: sizes.switchKnob,
    borderRadius: radii.full,
    backgroundColor: theme.colors.borderControl,
  },
  knobOn: { backgroundColor: theme.colors.plate },
}));
