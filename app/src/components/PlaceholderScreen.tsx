import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, textStyles } from '../theme';

type Props = {
  title: string;
  description: string;
  children?: ReactNode;
};

/** Temporary screen body used until each tab's milestone lands. */
export function PlaceholderScreen({ title, description, children }: Props) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.description}>{description}</Text>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    ...textStyles.sheetTitle,
    color: colors.text,
  },
  description: {
    ...textStyles.bodyLarge,
    color: colors.textSecondary,
  },
});
