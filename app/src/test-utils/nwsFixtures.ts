/**
 * Responses captured from api.weather.gov on 2026-11-26 (periods trimmed to
 * 24 hours and the JSON-LD @context removed; everything else as received).
 */
import { forecastToCache } from '../weather/forecast';
import { parseHourly } from '../weather/nws';
import type { CachedForecast } from '../weather/types';
import hourlyCheyenne from './fixtures/nws/nws-hourly-cheyenne.json';
import hourlyMinneapolis from './fixtures/nws/nws-hourly-minneapolis.json';
import pointsMinneapolis from './fixtures/nws/nws-points-minneapolis.json';
import pointsOutsideUs from './fixtures/nws/nws-points-outside-us.json';

export const NWS_FIXTURES = {
  hourlyCheyenne,
  hourlyMinneapolis,
  pointsMinneapolis,
  pointsOutsideUs,
};

/** Where each fixture was fetched. */
export const FIXTURE_PLACES = {
  minneapolis: { lat: 44.9778, lon: -93.265 },
  cheyenne: { lat: 41.14, lon: -104.82 },
  london: { lat: 51.5, lon: -0.12 },
} as const;

/** The real Cheyenne hours as a cache fetched at `fetchedAt` (default: start of the first hour). */
export function cheyenneCache(fetchedAt = Date.parse('2026-11-25T23:00:00-07:00')): CachedForecast {
  return forecastToCache(parseHourly(hourlyCheyenne), FIXTURE_PLACES.cheyenne, fetchedAt);
}
