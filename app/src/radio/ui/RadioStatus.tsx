import { Radio, RadioOff } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { Badge } from '../../components/Badge';

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
    <View style={styles.status} accessibilityRole="summary">
      <Badge
        tone={ready ? 'success' : 'neutral'}
        icon={ready ? Radio : RadioOff}
        label={radioCopy.link[link]}
      />
      {name ? <Text style={styles.name}>{name}</Text> : null}
      {details.length > 0 ? <Text style={styles.detail}>{details.join(' · ')}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  status: { gap: spacing.xs },
  name: { ...textStyles.label, color: theme.colors.text },
  detail: { ...textStyles.body, color: theme.colors.textSecondary },
}));
