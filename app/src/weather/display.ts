import type { LatLon } from '@huntclub/mesh';
import {
  UNKNOWN_SPOKEN,
  UNKNOWN_VALUE,
  describeAge,
  positionAge,
  temperatureReadout,
  windReadout,
} from '@huntclub/shared';

import { currentHour, isOutdated } from './forecast';
import type { CachedForecast } from './types';

/** What the conditions panel and your scent cone show for wind and temperature. */
export type WeatherDisplay = {
  /** "NW 10 mph", "Calm", or UNKNOWN_VALUE. */
  wind: string;
  windSpoken: string;
  /** Where the wind blows from (for the scent cone); null when calm or unknown. */
  windFromDeg: number | null;
  /** Where the "blowing toward" arrow points; null when calm or unknown. */
  windTowardDeg: number | null;
  /** "34°F" or UNKNOWN_VALUE. */
  temperature: string;
  temperatureSpoken: string;
  /** "Updated 3 hr ago" once the forecast is older than the refresh interval; else null. */
  updated: string | null;
  updatedSpoken: string | null;
};

export const UNKNOWN_WEATHER: WeatherDisplay = {
  wind: UNKNOWN_VALUE,
  windSpoken: UNKNOWN_SPOKEN,
  windFromDeg: null,
  windTowardDeg: null,
  temperature: UNKNOWN_VALUE,
  temperatureSpoken: UNKNOWN_SPOKEN,
  updated: null,
  updatedSpoken: null,
};

/** The cached forecast hour that covers now, worded by the shared readout (readout.ts). */
export function weatherDisplay(
  forecast: CachedForecast | null,
  place: LatLon | null,
  now: number,
): WeatherDisplay {
  const hour = currentHour(forecast, place, now);
  if (!forecast || !hour) return UNKNOWN_WEATHER;

  const wind = windReadout(hour.windMph, hour.windFromDeg);
  const temperature = temperatureReadout(hour.temperatureF);
  const age = isOutdated(forecast, now) ? describeAge(positionAge(forecast.fetchedAt, now)) : null;

  return {
    wind: wind.short,
    windSpoken: wind.spoken,
    windFromDeg: wind.fromDeg,
    windTowardDeg: wind.towardDeg,
    temperature: temperature.short,
    temperatureSpoken: temperature.spoken,
    updated: age ? `Updated ${age.short}` : null,
    updatedSpoken: age ? `forecast updated ${age.spoken}` : null,
  };
}
