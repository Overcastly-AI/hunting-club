import type { LatLon } from '@huntclub/mesh';
import { describeAge, positionAge } from '@huntclub/shared';

import { currentHour, isOutdated } from './forecast';
import type { CachedForecast } from './types';

/**
 * The cached forecast hour that covers now, as the inputs of the shared conditions readout
 * (`conditionsReadout` in @huntclub/shared words them: "NW 6 mph", "34°F", "—"). Null values
 * mean "not known": no forecast, outside its area, or its hours have ended.
 */
export type WeatherNow = {
  windMph: number | null;
  /** Where the wind blows from, in degrees; null when NWS gives no direction. */
  windFromDeg: number | null;
  temperatureF: number | null;
  /** "Updated 3 hr ago" once the forecast is older than the refresh interval; else null. */
  updated: string | null;
  updatedSpoken: string | null;
};

export const UNKNOWN_WEATHER: WeatherNow = {
  windMph: null,
  windFromDeg: null,
  temperatureF: null,
  updated: null,
  updatedSpoken: null,
};

/** The forecast hour that covers `now` at `place`, and how old the forecast is. */
export function weatherNow(
  forecast: CachedForecast | null,
  place: LatLon | null,
  now: number,
): WeatherNow {
  const hour = currentHour(forecast, place, now);
  if (!forecast || !hour) return UNKNOWN_WEATHER;
  const age = isOutdated(forecast, now) ? describeAge(positionAge(forecast.fetchedAt, now)) : null;
  return {
    windMph: hour.windMph,
    windFromDeg: hour.windFromDeg,
    temperatureF: hour.temperatureF,
    updated: age ? `Updated ${age.short}` : null,
    updatedSpoken: age ? `forecast updated ${age.spoken}` : null,
  };
}
