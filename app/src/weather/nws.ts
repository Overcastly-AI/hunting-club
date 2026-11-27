import type { LatLon } from '@huntclub/mesh';
import { HOUR_MS } from '@huntclub/core';
import { MILE_M } from '../map/geo';
import { compassPointToDegrees } from '@huntclub/shared';
import type { ForecastHour } from './types';

/**
 * Pure parsing of National Weather Service API responses (api.weather.gov,
 * free, no key, US only). Network code lives in nwsClient.ts.
 *
 * Flow: GET /points/{lat},{lon} → properties.forecastHourly → GET that URL
 * → properties.periods[] with startTime, endTime, temperature,
 * temperatureUnit, windSpeed ("10 mph") and windDirection ("NW"; "" when calm).
 */
export const NWS_ORIGIN = 'https://api.weather.gov';

/** NWS redirects requests with more than 4 decimal places, so round first. */
const POINT_DECIMALS = 4;

export function pointsUrl(place: LatLon): string {
  const round = (v: number) => Number(v.toFixed(POINT_DECIMALS));
  return `${NWS_ORIGIN}/points/${round(place.lat)},${round(place.lon)}`;
}

type Json = unknown;

function field(value: Json, key: string): Json {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, Json>)[key]
    : undefined;
}

const finite = (v: Json): v is number => typeof v === 'number' && Number.isFinite(v);

/** The hourly forecast URL from a /points response; null if missing or not an NWS URL. */
export function parsePoints(body: Json): string | null {
  const url = field(field(body, 'properties'), 'forecastHourly');
  return typeof url === 'string' && url.startsWith(`${NWS_ORIGIN}/`) ? url : null;
}

/** mph per one unit of each WMO speed unit NWS may send in quantitative values. */
const MPH_PER_UNIT: Record<string, number> = {
  'wmoUnit:km_h-1': 1000 / MILE_M,
  'wmoUnit:m_s-1': HOUR_MS / 1000 / MILE_M,
  'wmoUnit:kn': 1852 / MILE_M,
  'wmoUnit:mi_h-1': 1,
};

/**
 * Wind speed in mph. NWS sends a string ("10 mph", "5 to 10 mph", "10 km/h")
 * or, behind a feature flag, a quantitative value. For a range we keep the
 * upper value so the panel never understates the wind.
 */
export function parseWindSpeedMph(value: Json): number | null {
  if (typeof value === 'string') {
    const match = /^\s*(\d+(?:\.\d+)?)(?:\s+to\s+(\d+(?:\.\d+)?))?\s*(mph|km\/h)\s*$/i.exec(value);
    if (!match) return null;
    const speed = Number(match[2] ?? match[1]);
    return match[3]!.toLowerCase() === 'mph' ? speed : speed * MPH_PER_UNIT['wmoUnit:km_h-1']!;
  }
  const perUnit = MPH_PER_UNIT[String(field(value, 'unitCode'))];
  const speed = [field(value, 'maxValue'), field(value, 'value')].find(finite);
  return perUnit !== undefined && speed !== undefined ? speed * perUnit : null;
}

/** Temperature in °F from a number plus "F"/"C", or a quantitative value. */
export function parseTemperatureF(value: Json, unit: Json): number | null {
  const celsiusToF = (c: number) => (c * 9) / 5 + 32;
  if (finite(value)) {
    if (unit === 'F') return value;
    if (unit === 'C') return celsiusToF(value);
    return null;
  }
  const v = field(value, 'value');
  if (!finite(v)) return null;
  const code = field(value, 'unitCode');
  if (code === 'wmoUnit:degF') return v;
  if (code === 'wmoUnit:degC') return celsiusToF(v);
  return null;
}

function parsePeriod(period: Json): ForecastHour | null {
  const start = Date.parse(String(field(period, 'startTime')));
  const end = Date.parse(String(field(period, 'endTime')));
  const windMph = parseWindSpeedMph(field(period, 'windSpeed'));
  const temperatureF = parseTemperatureF(
    field(period, 'temperature'),
    field(period, 'temperatureUnit'),
  );
  const direction = field(period, 'windDirection');
  if (!Number.isFinite(start) || !(end > start) || windMph === null || temperatureF === null) {
    return null;
  }
  return {
    start,
    end,
    windMph,
    windFromDeg: typeof direction === 'string' ? compassPointToDegrees(direction) : null,
    temperatureF,
  };
}

/** Hours from a forecastHourly response, oldest first. Periods that don't parse are dropped. */
export function parseHourly(body: Json): ForecastHour[] {
  const periods = field(field(body, 'properties'), 'periods');
  if (!Array.isArray(periods)) return [];
  return periods
    .map(parsePeriod)
    .filter((hour): hour is ForecastHour => hour !== null)
    .sort((a, b) => a.start - b.start);
}
