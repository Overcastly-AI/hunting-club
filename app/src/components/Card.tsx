import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { makeStyles, radii, spacing, textStyles } from '../theme';

type Props = {
  /** Card title (title-3), read as a heading. */
  title?: string;
  /** A Badge beside the title, for example the radio's link status. */
  status?: ReactNode;
  children: ReactNode;
  /** Quiet caption line at the bottom, under a divider. */
  footer?: ReactNode;
};

/**
 * Card, as on the club admin (docs/UI_REDESIGN.md 4.4 and 6): surface-1 with a 1 px subtle
 * edge (never a card without one), 16 px radius and 20 px padding.
 */
export function Card({ title, status, children, footer }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.card}>
      {title ? (
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          {status ?? null}
        </View>
      ) : null}
      {children}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  card: {
    backgroundColor: theme.colors.surface1,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: radii.lg,
    padding: spacing[5],
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: { ...textStyles.title3, color: theme.colors.text, flexShrink: 1 },
  footer: { borderTopWidth: 1, borderColor: theme.colors.borderSubtle, paddingTop: spacing.md },
}));
