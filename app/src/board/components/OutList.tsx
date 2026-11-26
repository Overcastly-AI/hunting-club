import { TriangleAlert } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { ICON_SIZE, makeStyles, radii, sizes, spacing, textStyles, useTheme } from '../../theme';
import { entryAccessibilityLabel, entryTimeText, type BoardEntry } from '../boardModel';

/** Everyone out, big enough to read from across the clubhouse. Overdue hunters first, outlined in gold. */
export function OutList({ entries }: { entries: readonly BoardEntry[] }) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        Out now ({entries.length})
      </Text>
      {entries.length === 0 ? (
        <Text style={styles.empty}>Nobody is checked in.</Text>
      ) : (
        entries.map((entry) => (
          <View
            key={entry.node}
            accessible
            accessibilityLabel={entryAccessibilityLabel(entry)}
            style={[styles.row, entry.overdue && styles.overdue]}
          >
            <Text style={styles.name}>{entry.name}</Text>
            <Text style={styles.detail}>{entry.place}</Text>
            <View style={styles.timeRow}>
              {entry.overdue ? (
                <TriangleAlert
                  size={ICON_SIZE.lg}
                  color={theme.colors.warning}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
              ) : null}
              <Text style={[styles.detail, styles.time, entry.overdue && styles.overdueText]}>
                {entryTimeText(entry)}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  section: { gap: spacing.md },
  heading: { ...textStyles.boardName, color: theme.colors.text },
  empty: { ...textStyles.boardDetail, color: theme.colors.textSecondary },
  /** A card per hunter (surface-1, subtle edge, large radius), as on the phone. */
  row: {
    padding: spacing[5],
    gap: spacing.xs,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.surface1,
  },
  /** Overdue: thick gold outline and a warning sign, like the full-screen alert. Never red. */
  overdue: { borderColor: theme.colors.warning, borderWidth: sizes.hairline * 2 },
  name: { ...textStyles.boardName, color: theme.colors.text },
  detail: { ...textStyles.boardDetail, color: theme.colors.textSecondary },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  time: { flexShrink: 1 },
  overdueText: { color: theme.colors.warning },
}));
