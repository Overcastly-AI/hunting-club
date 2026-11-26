import { Text, View } from 'react-native';

import type { ClubStand } from '../../checkin/placement';
import { OPEN_STAND } from '../../map/labels';
import { makeStyles, spacing, textStyles } from '../../theme';

/** Club stands nobody is in, listed apart from the hunters. */
export function OpenStandsList({ stands }: { stands: readonly ClubStand[] }) {
  const styles = useStyles();
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

const useStyles = makeStyles((theme) => ({
  section: { gap: spacing.sm },
  heading: { ...textStyles.boardName, color: theme.colors.text },
  empty: { ...textStyles.boardDetail, color: theme.colors.textSecondary },
  list: { ...textStyles.boardDetail, color: theme.colors.text },
}));
