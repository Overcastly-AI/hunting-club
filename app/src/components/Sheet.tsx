import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from './Button';
import { makeStyles, radii, spacing, textStyles } from '../theme';

type Props = { visible: boolean; title: string; onClose: () => void; children: ReactNode };

/** A panel that slides up over the map, with a title and a Close button. */
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

const useStyles = makeStyles((theme) => ({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  dismiss: { flex: 1 },
  sheet: {
    maxHeight: '85%',
    backgroundColor: theme.colors.surface0,
    borderTopLeftRadius: radii.sheetTop,
    borderTopRightRadius: radii.sheetTop,
    borderTopWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: spacing.md,
    gap: spacing.md,
  },
  title: { ...textStyles.sheetTitle, color: theme.colors.text },
  content: { gap: spacing.md },
}));
