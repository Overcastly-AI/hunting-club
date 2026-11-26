import { Marker } from '@maplibre/maplibre-react-native';
import { StyleSheet, View } from 'react-native';

import { describeAge } from '../../map/age';
import { HaloText } from '../../map/components/HaloText';
import { colors, sizes, spacing, textStyles } from '../../theme';
import type { IncomingAlert } from '../alerts';

/** Map pin for someone who asked for a hand or is overdue. */
export function HelpMarker({ alert, now }: { alert: IncomingAlert; now: number }) {
  if (!alert.pin) return null;
  const what = alert.kind === 'help' ? 'asked for a hand' : 'is overdue';
  const age = describeAge(now - alert.heardAt);
  return (
    <Marker id={`alert-${alert.key}`} lngLat={[alert.pin.lon, alert.pin.lat]} anchor="top">
      <View
        accessible
        accessibilityLabel={`${alert.name} ${what}, ${age.spoken}`}
        style={styles.container}
      >
        <View style={styles.ring} />
        <HaloText style={styles.name}>
          {alert.name} {what}
        </HaloText>
        <HaloText>{age.short}</HaloText>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', minWidth: sizes.minTapTarget, paddingTop: spacing.xs },
  ring: {
    width: sizes.hunterMarker,
    height: sizes.hunterMarker,
    borderRadius: sizes.hunterMarker / 2,
    borderWidth: sizes.freshnessRing + 1,
    borderColor: colors.help,
    backgroundColor: colors.surface,
  },
  name: { ...textStyles.markerName, color: colors.help, marginTop: spacing.xs },
});
