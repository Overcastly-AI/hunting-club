import { View } from 'react-native';

import { makeStyles, radii, sizes, spacing } from '../theme';

/** The grab handle at the top of a sheet. Decoration: hidden from screen readers. */
export function Grabber() {
  const styles = useStyles();
  return <View style={styles.grabber} importantForAccessibility="no" accessibilityElementsHidden />;
}

const useStyles = makeStyles((theme) => ({
  grabber: {
    alignSelf: 'center',
    width: sizes.grabberWidth,
    height: sizes.grabberHeight,
    borderRadius: radii.full,
    backgroundColor: theme.colors.borderControl,
    marginTop: spacing.sm,
  },
}));
