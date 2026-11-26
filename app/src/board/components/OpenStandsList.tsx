import { StyleSheet, Text, View } from 'react-native';

import type { ClubStand } from '../../checkin/placement';
import { OPEN_STAND } from '../../map/labels';
import { colors, spacing, textStyles } from '../../theme';

/** Club stands nobody is in, listed apart from the hunters. */
export function OpenStandsList({ stands }: { stands: readonly ClubStand[] }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        {OPEN_STAND} stands ({stands.length})
      </Text>
      {stands.length === 0 ? (
        <Text style={styles.empty}>No open stands.</Text>
      ) : (
        <Text style={styles.list}>{stands.map((stand) => stand.name).join(' · ')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  heading: { ...textStyles.boardName, color: colors.text },
  empty: { ...textStyles.boardDetail, color: colors.textSecondary },
  list: { ...textStyles.boardDetail, color: colors.text },
});
