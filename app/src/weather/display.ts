import { UNKNOWN_SPOKEN, UNKNOWN_VALUE } from '../conditions/display';
import type { LatLon } from '../domain/location';
import { describeAge, elapsedMs } from '../domain/time';
import { downwindBearing } from '../map/geo';
import { degreesToCompassPoint } from './compass';
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

export const CALM = 'Calm';

export function weatherDisplay(
  forecast: CachedForecast | null,
  place: LatLon | null,
  now: number,
): WeatherDisplay {
  const hour = currentHour(forecast, place, now);
  if (!forecast || !hour) return UNKNOWN_WEATHER;

  const mph = Math.round(hour.windMph);
  const from = mph > 0 ? hour.windFromDeg : null;
  const toward = from === null ? null : downwindBearing(from);
  const temperature = `${Math.round(hour.temperatureF)}°F`;
  const age = isOutdated(forecast, now) ? describeAge(elapsedMs(forecast.fetchedAt, now)) : null;

  let wind: string;
  let windSpoken: string;
  if (mph === 0) {
    wind = CALM;
    windSpoken = 'calm';
  } else if (from === null || toward === null) {
    wind = `${mph} mph`;
    windSpoken = wind;
  } else {
    wind = `${degreesToCompassPoint(from)} ${mph} mph`;
    windSpoken = `${mph} mph from ${degreesToCompassPoint(from)}, blowing toward ${degreesToCompassPoint(toward)}`;
  }

  return {
    wind,
    windSpoken,
    windFromDeg: from,
    windTowardDeg: toward,
    temperature,
    temperatureSpoken: temperature,
    updated: age ? `Updated ${age.short}` : null,
    updatedSpoken: age ? `forecast updated ${age.spoken}` : null,
  };
}
