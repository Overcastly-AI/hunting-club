import { Text, View } from 'react-native';

import type { LatLon } from '@huntclub/mesh';
import { sunReadout, type SunReadout } from '@huntclub/shared';

import { WindArrowIcon } from '../../components/icons';
import { makeStyles, radii, sizes, spacing, textStyles } from '../../theme';
import { UNKNOWN_WEATHER, type WeatherDisplay } from '../../weather/display';

type Props = {
  /** Where to compute sunrise and sunset; null until the map knows where it is. */
  place: LatLon | null;
  now: number;
  /** Wind and temperature from useConditions; "—" until a forecast covers now. */
  weather?: WeatherDisplay;
};

/** Joins words with no-break spaces so a line never breaks inside one phrase ("7:03 AM"). */
const keepTogether = (text: string) => text.replace(/ /g, '\u00A0');

/**
 * "Sunrise 7:03 AM" and "Sunset 4:26 PM" as two unbreakable phrases. The panel
 * may wrap between them at large text sizes, but never truncates or splits a time.
 */
export function sunPhrases(sun: Pick<SunReadout, 'sunrise' | 'sunset'>): [string, string] {
  return [keepTogether(`Sunrise ${sun.sunrise.short}`), keepTogether(`Sunset ${sun.sunset.short}`)];
}

/** "Sunrise 7:03 AM · Sunset 4:26 PM": wraps only after the dot, never inside a time. */
export function sunSentence(sun: Pick<SunReadout, 'sunrise' | 'sunset'>): string {
  const [sunrisePhrase, sunsetPhrase] = sunPhrases(sun);
  return `${sunrisePhrase}\u00A0· ${sunsetPhrase}`;
}

export function ConditionsPanel({ place, now, weather = UNKNOWN_WEATHER }: Props) {
  const styles = useStyles();
  // Sunrise and sunset only; never legal shooting hours.
  const sun = sunReadout(place, now);
  const spoken = [
    `Sunrise ${sun.sunrise.spoken}, sunset ${sun.sunset.spoken}.`,
    `Wind ${weather.windSpoken}.`,
    `Temperature ${weather.temperatureSpoken}.`,
    weather.updatedSpoken ? `${weather.updatedSpoken}.` : null,
  ];
  return (
    <View accessible accessibilityLabel={spoken.filter(Boolean).join(' ')} style={styles.panel}>
      <Text style={styles.primary}>{sunSentence(sun)}</Text>
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
    backgroundColor: theme.colors.plate,
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
