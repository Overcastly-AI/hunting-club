import { StyleSheet, Text } from 'react-native';

import { colors, textStyles } from '../theme';
import type { SendStatus } from './CheckInRadio';

const TONE = { busy: colors.textSecondary, ok: colors.fresh, problem: colors.help } as const;

/** One line saying whether the check-in or check-out went out; announced by screen readers. */
export function SendStatusText({ status }: { status: SendStatus }) {
  if (!status) return null;
  return (
    <Text
      accessibilityLiveRegion="polite"
      accessibilityRole="text"
      style={[styles.text, { color: TONE[status.tone] }]}
    >
      {status.text}
    </Text>
  );
}

const styles = StyleSheet.create({ text: { ...textStyles.body } });
