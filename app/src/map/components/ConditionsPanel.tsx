import { StyleSheet, Text, View } from 'react-native';

import { formatClockTime, localCalendarDay, sunTimes } from '../../conditions/sun';
import { colors, radii, sizes, spacing, textStyles } from '../../theme';
import type { LatLon } from '@huntclub/mesh';

/** Shown for values not known yet (wind and temperature until the forecast milestone). */
export const UNKNOWN_VALUE = '—';

type Props = {
  /** Where to compute sunrise and sunset; null until the map knows where it is. */
  place: LatLon | null;
  now: number;
  /** Wind and temperature arrive with the forecast milestone. */
  wind?: string;
  temperature?: string;
};

/** Sunrise and sunset only; never legal shooting hours. */
export function sunLine(place: LatLon | null, now: number): { sunrise: string; sunset: string } {
  if (!place) return { sunrise: UNKNOWN_VALUE, sunset: UNKNOWN_VALUE };
  const times = sunTimes(localCalendarDay(new Date(now)), place.lat, place.lon);
  if (times.kind === 'polarDay') return { sunrise: 'Up all day', sunset: 'Up all day' };
  if (times.kind === 'polarNight') return { sunrise: 'Down all day', sunset: 'Down all day' };
  return { sunrise: formatClockTime(times.sunrise), sunset: formatClockTime(times.sunset) };
}

export function ConditionsPanel({
  place,
  now,
  wind = UNKNOWN_VALUE,
  temperature = UNKNOWN_VALUE,
}: Props) {
  const { sunrise, sunset } = sunLine(place, now);
  return (
    <View
      accessible
      accessibilityLabel={`Sunrise ${sunrise}, sunset ${sunset}. Wind ${wind === UNKNOWN_VALUE ? 'not known yet' : wind}. Temperature ${temperature === UNKNOWN_VALUE ? 'not known yet' : temperature}.`}
      style={styles.panel}
    >
      <Text style={styles.primary} numberOfLines={1} adjustsFontSizeToFit>
        Sunrise {sunrise} · Sunset {sunset}
      </Text>
      <View style={styles.row}>
        <Text style={styles.secondary}>
          Wind <Text style={styles.wind}>{wind}</Text>
        </Text>
        <Text style={styles.secondary}>{temperature}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: sizes.control,
    backgroundColor: colors.surface,
    borderRadius: radii.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  primary: { ...textStyles.label, color: colors.text },
  secondary: { ...textStyles.body, color: colors.textSecondary },
  wind: { color: colors.wind },
});
