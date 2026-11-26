import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from './Button';
import { colors, radii, spacing, textStyles } from '../theme';

type Props = { visible: boolean; title: string; onClose: () => void; children: ReactNode };

/** A panel that slides up over the map, with a title and a Close button. */
export function Sheet({ visible, title, onClose, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Tapping above the sheet closes it; screen readers use the Close button instead. */}
        <Pressable
          style={styles.dismiss}
          onPress={onClose}
          importantForAccessibility="no"
          accessibilityElementsHidden
        />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}
        >
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
          <Button label="Close" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  dismiss: { flex: 1 },
  sheet: {
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheetTop,
    borderTopRightRadius: radii.sheetTop,
    borderTopWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  title: { ...textStyles.sheetTitle, color: colors.text },
  content: { gap: spacing.md },
});
