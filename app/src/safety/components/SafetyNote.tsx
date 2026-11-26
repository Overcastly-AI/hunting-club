import { StyleSheet, Text } from 'react-native';

import { colors, textStyles } from '../../theme';
import { SAFETY_NOTE } from '../wording';

/** The plain note in settings. The only place the app mentions 911. */
export function SafetyNote() {
  return <Text style={styles.note}>{SAFETY_NOTE}</Text>;
}

const styles = StyleSheet.create({ note: { ...textStyles.body, color: colors.textSecondary } });
