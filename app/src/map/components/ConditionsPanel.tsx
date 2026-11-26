import { Text, View } from 'react-native';

import { SUN } from '@huntclub/core';
import type { LatLon } from '@huntclub/mesh';

import { WindArrowIcon } from '../../components/icons';
import { formatClockTime } from '../../conditions/clock';
import { UNKNOWN_VALUE } from '../../conditions/display';
import { makeStyles, radii, sizes, spacing, textStyles } from '../../theme';
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
  const times = SUN.sunTimes(SUN.localCalendarDay(new Date(now)), place.lat, place.lon);
  if (times.kind === 'polarDay') return { sunrise: 'Up all day', sunset: 'Up all day' };
  if (times.kind === 'polarNight') return { sunrise: 'Down all day', sunset: 'Down all day' };
  return { sunrise: formatClockTime(times.sunrise), sunset: formatClockTime(times.sunset) };
}

/** Joins words with no-break spaces so a line never breaks inside one phrase ("7:03 AM"). */
const keepTogether = (text: string) => text.replace(/ /g, '\u00A0');

/**
 * "Sunrise 7:03 AM" and "Sunset 4:26 PM" as two unbreakable phrases. The panel
 * may wrap between them at large text sizes, but never truncates or splits a time.
 */
export function sunPhrases(sun: { sunrise: string; sunset: string }): [string, string] {
  return [keepTogether(`Sunrise ${sun.sunrise}`), keepTogether(`Sunset ${sun.sunset}`)];
}

/** "Sunrise 7:03 AM · Sunset 4:26 PM": wraps only after the dot, never inside a time. */
export function sunSentence(sun: { sunrise: string; sunset: string }): string {
  const [sunrisePhrase, sunsetPhrase] = sunPhrases(sun);
  return `${sunrisePhrase}\u00A0· ${sunsetPhrase}`;
}

export function ConditionsPanel({ place, now, weather = UNKNOWN_WEATHER }: Props) {
  const styles = useStyles();
  const { sunrise, sunset } = sunLine(place, now);
  const spoken = [
    `Sunrise ${sunrise}, sunset ${sunset}.`,
    `Wind ${weather.windSpoken}.`,
    `Temperature ${weather.temperatureSpoken}.`,
    weather.updatedSpoken ? `${weather.updatedSpoken}.` : null,
  ];
  return (
    <View accessible accessibilityLabel={spoken.filter(Boolean).join(' ')} style={styles.panel}>
      <Text style={styles.primary}>{sunSentence({ sunrise, sunset })}</Text>
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
      {weather.updated ? <Text style={styles.secondary}>{weather.updated}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  panel: {
    flex: 1,
    minHeight: sizes.control,
    backgroundColor: theme.colors.surface0,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.colors.borderControl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  windGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  primary: { ...textStyles.labelNarrow, color: theme.colors.text },
  secondary: { ...textStyles.body, color: theme.colors.textSecondary },
  wind: { color: theme.colors.info },
}));
