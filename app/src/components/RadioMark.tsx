import { View } from 'react-native';

import { makeStyles, radii, sizes } from '../theme';

/**
 * The round mark at the end of a pick-one row: an empty ring, or an orange dot in an accent
 * ring when chosen. Shape says it as well as colour. Decorative: the row says "selected".
 */
export function RadioMark({ chosen }: { chosen: boolean }) {
  const styles = useStyles();
  return (
    <View
      importantForAccessibility="no"
      accessibilityElementsHidden
      style={[styles.ring, chosen && styles.chosenRing]}
    >
      {chosen ? <View style={styles.dot} /> : null}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  ring: {
    width: sizes.radioMark,
    height: sizes.radioMark,
    borderRadius: radii.full,
    borderWidth: sizes.selectedBorder,
    borderColor: theme.colors.borderControl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chosenRing: { borderColor: theme.colors.accentBorder },
  dot: {
    width: sizes.radioDot,
    height: sizes.radioDot,
    borderRadius: radii.full,
    backgroundColor: theme.colors.accent,
  },
}));
