import { Text } from 'react-native';

import { makeStyles, textStyles } from '../../theme';
import { SAFETY_NOTE } from '../wording';

/** The plain note in settings. The only place the app mentions 911. */
export function SafetyNote() {
  const styles = useStyles();
  return <Text style={styles.note}>{SAFETY_NOTE}</Text>;
}

const useStyles = makeStyles((theme) => ({
  note: { ...textStyles.body, color: theme.colors.textSecondary },
}));
