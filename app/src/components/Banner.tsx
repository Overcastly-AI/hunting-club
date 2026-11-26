import type { ReactNode } from 'react';
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
import { useAnnounce } from './announce';
import { TONE_ICONS } from './Badge';

export type BannerTone = Exclude<StatusTone, 'neutral'>;

type Props = {
  tone: BannerTone;
  title?: string;
  children: string;
  /** One action under the text, usually a Button. */
  action?: ReactNode;
  /** Announce it when it appears (for messages that come and go, like a failed send). */
  live?: boolean;
};

/**
 * An inline message (docs/UI_REDESIGN.md section 6): icon, optional title, text and one
 * action, all in the tone's colour on its tint.
 */
export function Banner({ tone, title, children, action, live }: Props) {
  const styles = useStyles();
  const theme = useTheme();
  const Icon = TONE_ICONS[tone];
  const ink = { color: theme.colors[STATUS_TONE_COLORS[tone].foreground] };
  const spoken = title ? `${title}. ${children}` : children;
  useAnnounce(live ? spoken : undefined);
  return (
    <View style={[styles.banner, styles[tone]]}>
      <View
        accessible
        accessibilityLabel={spoken}
        accessibilityLiveRegion={live ? 'polite' : 'none'}
        style={styles.row}
      >
        <Icon
          size={ICON_SIZE.md}
          color={ink.color}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View style={styles.body}>
          {title ? <Text style={[styles.title, ink]}>{title}</Text> : null}
          <Text style={[styles.text, ink]}>{children}</Text>
        </View>
      </View>
      {action ?? null}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  banner: { borderRadius: radii.md, padding: spacing.md, gap: spacing.sm + spacing.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm + spacing.xs },
  body: { flex: 1, gap: spacing.xs },
  title: { ...textStyles.label },
  text: { ...textStyles.body },
  success: { backgroundColor: theme.colors[STATUS_TONE_COLORS.success.background] },
  warning: { backgroundColor: theme.colors[STATUS_TONE_COLORS.warning.background] },
  danger: { backgroundColor: theme.colors[STATUS_TONE_COLORS.danger.background] },
  info: { backgroundColor: theme.colors[STATUS_TONE_COLORS.info.background] },
}));
