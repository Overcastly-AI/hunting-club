import { StyleSheet, Text, View } from 'react-native';

import { WindArrowIcon } from '../../components/icons';
import { UNKNOWN_VALUE } from '../../conditions/display';
import { formatClockTime, localCalendarDay, sunTimes } from '../../conditions/sun';
import { colors, radii, sizes, spacing, textStyles } from '../../theme';
import type { LatLon } from '../../domain/location';
import { UNKNOWN_WEATHER, type WeatherDisplay } from '../../weather/display';

type Props = {
  /** Where to compute sunrise and sunset; null until the map knows where it is. */
  place: LatLon | null;
  now: number;
  /** Wind and temperature from useConditions; "—" until a forecast covers now. */
  weather?: WeatherDisplay;
};

/** Sunrise and sunset only; never legal shooting hours. */
export function sunLine(place: LatLon | null, now: number): { sunrise: string; sunset: string } {
  if (!place) return { sunrise: UNKNOWN_VALUE, sunset: UNKNOWN_VALUE };
  const times = sunTimes(localCalendarDay(new Date(now)), place.lat, place.lon);
  if (times.kind === 'polarDay') return { sunrise: 'Up all day', sunset: 'Up all day' };
  if (times.kind === 'polarNight') return { sunrise: 'Down all day', sunset: 'Down all day' };
  return { sunrise: formatClockTime(times.sunrise), sunset: formatClockTime(times.sunset) };
}

export function ConditionsPanel({ place, now, weather = UNKNOWN_WEATHER }: Props) {
  const { sunrise, sunset } = sunLine(place, now);
  const spoken = [
    `Sunrise ${sunrise}, sunset ${sunset}.`,
    `Wind ${weather.windSpoken}.`,
    `Temperature ${weather.temperatureSpoken}.`,
    weather.updatedSpoken ? `${weather.updatedSpoken}.` : null,
  ];
  return (
    <View accessible accessibilityLabel={spoken.filter(Boolean).join(' ')} style={styles.panel}>
      <Text style={styles.primary} numberOfLines={1} adjustsFontSizeToFit>
        Sunrise {sunrise} · Sunset {sunset}
      </Text>
      <View style={styles.row}>
        <View style={styles.windGroup}>
          <Text style={styles.secondary}>
            Wind <Text style={styles.wind}>{weather.wind}</Text>
          </Text>
          {weather.windTowardDeg !== null ? (
            <WindArrowIcon towardDeg={weather.windTowardDeg} />
          ) : null}
        </View>
        <Text style={styles.secondary}>{weather.temperature}</Text>
      </View>
      {weather.updated ? (
        <Text style={styles.secondary} numberOfLines={1}>
          {weather.updated}
        </Text>
      ) : null}
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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  windGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  primary: { ...textStyles.label, color: colors.text },
  secondary: { ...textStyles.body, color: colors.textSecondary },
  wind: { color: colors.wind },
});
