import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo, Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, sizes, spacing, textStyles } from '../../theme';

type Props = { visible: boolean; title: string; detail: string; children: ReactNode };

/**
 * Full-screen alert for safety events. Gold, not red, and announced to
 * screen readers when it appears.
 */
export function AlertScreen({ visible, title, detail, children }: Props) {
  useEffect(() => {
    if (visible) AccessibilityInfo.announceForAccessibility(`${title}. ${detail}`);
  }, [visible, title, detail]);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={() => undefined}>
      <SafeAreaView style={styles.screen}>
        <View accessibilityViewIsModal style={styles.card}>
          <Text accessibilityRole="header" accessibilityLiveRegion="assertive" style={styles.title}>
            {title}
          </Text>
          <Text style={styles.detail}>{detail}</Text>
          <View style={styles.actions}>{children}</View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    padding: spacing.md,
  },
  card: {
    borderWidth: sizes.hairline,
    borderColor: colors.help,
    borderRadius: radii.sheetTop,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { ...textStyles.sheetTitle, color: colors.help },
  detail: { ...textStyles.bodyLarge, color: colors.text },
  actions: { gap: spacing.sm },
});
