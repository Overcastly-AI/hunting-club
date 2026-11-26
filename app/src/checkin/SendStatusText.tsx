import { StyleSheet, Text } from 'react-native';

import { textStyles, useTheme, type ThemeColorToken } from '../theme';
import type { SendStatus } from './CheckInRadio';

const TONE = {
  busy: 'textSecondary',
  ok: 'success',
  problem: 'warning',
} as const satisfies Record<NonNullable<SendStatus>['tone'], ThemeColorToken>;

/** One line saying whether the check-in or check-out went out; announced by screen readers. */
export function SendStatusText({ status }: { status: SendStatus }) {
  const theme = useTheme();
  if (!status) return null;
  return (
    <Text
      accessibilityLiveRegion="polite"
      accessibilityRole="text"
      style={[styles.text, { color: theme.colors[TONE[status.tone]] }]}
    >
      {status.text}
    </Text>
  );
}

const styles = StyleSheet.create({ text: { ...textStyles.body } });
