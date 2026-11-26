import { Text, View } from 'react-native';

import { makeStyles, radii, sizes, spacing, textStyles } from '../../theme';
import { entryAccessibilityLabel, entryTimeText, type BoardEntry } from '../boardModel';

/** Everyone out, big enough to read from across the clubhouse. Overdue hunters first, outlined in gold. */
export function OutList({ entries }: { entries: readonly BoardEntry[] }) {
  const styles = useStyles();
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
            <Text style={[styles.detail, entry.overdue && styles.overdueText]}>
              {entryTimeText(entry)}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  section: { gap: spacing.sm },
  heading: { ...textStyles.boardName, color: theme.colors.text },
  empty: { ...textStyles.boardDetail, color: theme.colors.textSecondary },
  row: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.control,
    borderWidth: sizes.hairline,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.surface2,
  },
  /** Overdue: thick gold outline, like the full-screen alert. Never red. */
  overdue: { borderColor: theme.colors.warning, borderWidth: sizes.hairline * 2 },
  name: { ...textStyles.boardName, color: theme.colors.text },
  detail: { ...textStyles.boardDetail, color: theme.colors.textSecondary },
  overdueText: { color: theme.colors.warning },
}));
