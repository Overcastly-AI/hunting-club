import {
  CircleAlert,
  CircleCheck,
  CircleDot,
  Info,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react-native';
import { Text, View } from 'react-native';

import {
  ICON_SIZE,
  makeStyles,
  radii,
  spacing,
  STATUS_TONE_COLORS,
  textStyles,
  useTheme,
  type StatusTone,
} from '../theme';

/** Each tone's icon when the caller gives none (the same five as the club admin). */
export const TONE_ICONS: Record<StatusTone, LucideIcon> = {
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
  info: Info,
  neutral: CircleDot,
};

type Props = { tone: StatusTone; label: string; icon?: LucideIcon };

/**
 * Badge / StatusPill: an icon and a word on the tone's tint, so status is never colour
 * alone. The pairs are held to 4.5:1 in both themes (STATUS_TONE_COLORS in @huntclub/design).
 */
export function Badge({ tone, label, icon }: Props) {
  const styles = useStyles();
  const theme = useTheme();
  const Icon = icon ?? TONE_ICONS[tone];
  return (
    <View accessible accessibilityLabel={label} style={[styles.badge, styles[tone]]}>
      <Icon
        size={ICON_SIZE.sm}
        color={theme.colors[STATUS_TONE_COLORS[tone].foreground]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Text style={[styles.text, styles[`${tone}Text`]]}>{label}</Text>
    </View>
  );
}

/** The web kit's name for a Badge that shows a status. */
export const StatusPill = Badge;

const useStyles = makeStyles((theme) => {
  const fill = (tone: StatusTone) => ({
    backgroundColor: theme.colors[STATUS_TONE_COLORS[tone].background],
  });
  const ink = (tone: StatusTone) => ({ color: theme.colors[STATUS_TONE_COLORS[tone].foreground] });
  return {
    badge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: 2,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.sm,
    },
    text: { ...textStyles.badge, flexShrink: 1 },
    success: fill('success'),
    warning: fill('warning'),
    danger: fill('danger'),
    info: fill('info'),
    neutral: fill('neutral'),
    successText: ink('success'),
    warningText: ink('warning'),
    dangerText: ink('danger'),
    infoText: ink('info'),
    neutralText: ink('neutral'),
  };
});
