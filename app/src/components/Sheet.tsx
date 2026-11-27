import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Grabber } from './Grabber';
import { Button } from './Button';
import { makeStyles, radii, spacing, textStyles } from '../theme';

type Props = { visible: boolean; title: string; onClose: () => void; children: ReactNode };

/**
 * A sheet that slides up over the map (docs/DESIGN.md "Layout"): a dark plate with a 16 px top,
 * a grab handle, the title with Close beside it, and the content under them.
 */
export function Sheet({ visible, title, onClose, children }: Props) {
  const styles = useStyles();
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
          <Grabber />
          <View style={styles.head}>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <Button label="Close" onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((theme) => ({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  dismiss: { flex: 1 },
  sheet: {
    maxHeight: '85%',
    backgroundColor: theme.colors.plate,
    borderTopLeftRadius: radii.sheetTop,
    borderTopRightRadius: radii.sheetTop,
    borderTopWidth: 1,
    borderColor: theme.colors.borderSubtle,
    paddingHorizontal: spacing.sm + spacing.xs,
    gap: spacing.sm,
  },
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: { ...textStyles.title2, color: theme.colors.text, flexShrink: 1 },
  content: { gap: spacing.md, paddingBottom: spacing.sm },
}));
