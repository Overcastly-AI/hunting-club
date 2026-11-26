import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { ICON_SIZE, makeStyles, radii, spacing, textStyles, useTheme } from '../theme';

type Props = {
  icon: LucideIcon;
  title: string;
  /** One or two short sentences on what fills this space and how. */
  children?: string;
  /** At most one action, usually a Button. */
  action?: ReactNode;
};

/**
 * What an empty list says instead of "No X yet." (docs/UI_REDESIGN.md section 6): a 48 px
 * icon, a title (title-3), a short body and one action.
 */
export function EmptyState({ icon: Icon, title, children, action }: Props) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <View
        accessible
        accessibilityLabel={children ? `${title}. ${children}` : title}
        style={styles.texts}
      >
        <View style={styles.icon}>
          <Icon
            size={ICON_SIZE.empty}
            strokeWidth={1.5}
            color={theme.colors.textSecondary}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        </View>
        <Text style={styles.title}>{title}</Text>
        {children ? <Text style={styles.body}>{children}</Text> : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  empty: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
  texts: { alignItems: 'center', gap: spacing.sm + spacing.xs },
  icon: {
    padding: spacing.md,
    borderRadius: radii.full,
    backgroundColor: theme.colors.surface2,
  },
  title: { ...textStyles.title3, color: theme.colors.text, textAlign: 'center' },
  body: { ...textStyles.body, color: theme.colors.textSecondary, textAlign: 'center' },
  action: { alignSelf: 'stretch', marginTop: spacing.sm },
}));
