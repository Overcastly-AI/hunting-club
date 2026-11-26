import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { makeStyles, spacing, textStyles } from '../theme';

type Props = {
  title: string;
  description?: string;
  /** Scroll the body (default). Turn off for screens that manage their own lists. */
  scroll?: boolean;
  children?: ReactNode;
};

/** Standard screen frame: safe area, sheet-style title, optional description. */
export function Screen({ title, description, scroll = true, children }: Props) {
  const styles = useStyles();
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

const useStyles = makeStyles((theme) => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.surface0,
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
    color: theme.colors.text,
  },
  description: {
    ...textStyles.bodyLarge,
    color: theme.colors.textSecondary,
  },
}));
