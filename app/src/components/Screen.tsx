import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, textStyles } from '../theme';

type Props = {
  title: string;
  description?: string;
  /** Scroll the body (default). Turn off for screens that manage their own lists. */
  scroll?: boolean;
  children?: ReactNode;
};

/** Standard screen frame: safe area, sheet-style title, optional description. */
export function Screen({ title, description, scroll = true, children }: Props) {
  const header = (
    <>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </>
  );
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill]}>
          {header}
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  fill: {
    flex: 1,
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
