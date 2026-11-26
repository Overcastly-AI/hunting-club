import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, sizes, spacing, textStyles } from '../../theme';
import { entryAccessibilityLabel, entryTimeText, type BoardEntry } from '../boardModel';

/** Everyone out, big enough to read from across the clubhouse. Overdue hunters first, outlined in gold. */
export function OutList({ entries }: { entries: readonly BoardEntry[] }) {
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

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  heading: { ...textStyles.boardName, color: colors.text },
  empty: { ...textStyles.boardDetail, color: colors.textSecondary },
  row: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.control,
    borderWidth: sizes.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  /** Overdue: thick gold outline, like the full-screen alert. Never red. */
  overdue: { borderColor: colors.help, borderWidth: sizes.hairline * 2 },
  name: { ...textStyles.boardName, color: colors.text },
  detail: { ...textStyles.boardDetail, color: colors.textSecondary },
  overdueText: { color: colors.help },
});
