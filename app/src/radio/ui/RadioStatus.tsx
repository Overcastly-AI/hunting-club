import { Text, View } from 'react-native';

import { makeStyles, spacing, textStyles } from '../../theme';
import { radioCopy } from '../copy';
import { useRadio } from '../RadioProvider';

/** Meshtastic reports 101 for "plugged in / no battery". */
const PLUGGED_IN_LEVEL = 101;

/** One-line link status, plus the radio's name, battery and software when known. */
export function RadioStatus() {
  const styles = useStyles();
  const { link, radio, pairedRadio } = useRadio();
  const ready = link === 'ready';
  const details: string[] = [];
  if (ready && radio) {
    if (radio.batteryLevel !== undefined) {
      details.push(
        radio.batteryLevel >= PLUGGED_IN_LEVEL
          ? radioCopy.info.plugged
          : radioCopy.info.battery(radio.batteryLevel),
      );
    }
    if (radio.firmwareVersion) details.push(radioCopy.info.firmware(radio.firmwareVersion));
  }
  const name = radio?.longName ?? pairedRadio?.name;

  return (
    <View style={styles.row} accessibilityRole="summary">
      <View style={[styles.dot, ready ? styles.dotReady : styles.dotIdle]} />
      <View style={styles.text}>
        <Text style={styles.status}>{radioCopy.link[link]}</Text>
        {name ? <Text style={styles.detail}>{name}</Text> : null}
        {details.length > 0 ? <Text style={styles.detail}>{details.join(' · ')}</Text> : null}
      </View>
    </View>
  );
}

const DOT = 14;

const useStyles = makeStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    marginTop: spacing.xs,
  },
  dotReady: { backgroundColor: theme.colors.success },
  dotIdle: { backgroundColor: theme.colors.textSecondary },
  text: { flex: 1, gap: spacing.xs },
  status: { ...textStyles.label, color: theme.colors.text },
  detail: { ...textStyles.body, color: theme.colors.textSecondary },
}));
