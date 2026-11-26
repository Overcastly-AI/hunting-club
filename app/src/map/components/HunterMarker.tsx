import { StyleSheet, Text, View } from 'react-native';

import { colors, opacity, sizes, spacing, textStyles } from '../../theme';
import { describeAge, elapsedMs } from '../../domain/time';
import { classifyFreshness, type Freshness } from '../freshness';
import { hunterAccessibilityLabel, placeLabel } from '../labels';
import type { HunterOnMap } from '../types';
import { HaloText } from './HaloText';

type Props = { hunter: HunterOnMap; now: number };

/** Ring style by freshness: solid under 2 min, dashed 2–10 min, faded after. */
const RING: Record<Freshness, { borderColor: string; borderStyle: 'solid' | 'dashed' }> = {
  fresh: { borderColor: colors.fresh, borderStyle: 'solid' },
  stale: { borderColor: colors.help, borderStyle: 'dashed' },
  faded: { borderColor: colors.textSecondary, borderStyle: 'solid' },
};

/**
 * Another hunter: initials in a circle with a freshness ring, the stand, spot
 * or area name (or "On the move") and how long ago they were heard.
 */
export function HunterMarker({ hunter, now }: Props) {
  const age = elapsedMs(hunter.heardAt, now);
  const freshness = classifyFreshness(age);
  return (
    <View
      accessible
      accessibilityLabel={hunterAccessibilityLabel(hunter, now)}
      style={[styles.container, freshness === 'faded' && styles.faded]}
    >
      <View style={[styles.circle, RING[freshness]]}>
        <Text style={styles.initials} numberOfLines={1}>
          {hunter.initials}
        </Text>
      </View>
      <HaloText style={styles.name} numberOfLines={1}>
        {placeLabel(hunter.place)}
      </HaloText>
      <HaloText style={styles.age} numberOfLines={1}>
        {describeAge(age).short}
      </HaloText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', minWidth: sizes.minTapTarget, paddingTop: spacing.xs },
  faded: { opacity: opacity.faded },
  circle: {
    width: sizes.hunterMarker,
    height: sizes.hunterMarker,
    borderRadius: sizes.hunterMarker / 2,
    borderWidth: sizes.freshnessRing,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { ...textStyles.markerName, color: colors.text },
  name: { ...textStyles.markerName, marginTop: spacing.xs },
  age: { color: colors.textSecondary },
});
