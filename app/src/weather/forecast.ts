import type { LatLon } from '@huntclub/mesh';
import { HOUR_MS, MINUTE_MS, positionAge } from '@huntclub/core';
import { distanceMeters } from '../map/geo';
import { FORECAST_CACHE_VERSION, type CachedForecast, type ForecastHour } from './types';

/** When to fetch, what to keep and where a cached forecast still applies. */
export const FORECAST_POLICY = {
  /**
   * Hours kept from each fetch. Enough that a 5 am sync still covers the
   * evening sit when the phone is offline all day.
   */
  keepHours: 18,
  /** Refetch when online and the forecast is older than this. */
  refreshAfterMs: HOUR_MS,
  /** Refetch when you have moved this far from where it was fetched. */
  refreshDistanceMeters: 5_000,
  /**
   * Show a cached forecast only within this distance of where it was fetched,
   * so a sync at home still covers a stand a short drive away.
   */
  maxDistanceMeters: 40_000,
  /** Wait this long between attempts, so panning the map doesn't spam NWS. */
  minAttemptGapMs: MINUTE_MS,
  /** Wait this long after a failed attempt (offline, outside the US, NWS down). */
  retryAfterFailureMs: 5 * MINUTE_MS,
} as const;

/** The cache to store after a fetch: hours that haven't ended yet, up to keepHours. */
export function forecastToCache(
  hours: readonly ForecastHour[],
  place: LatLon,
  fetchedAt: number,
): CachedForecast {
  return {
    version: FORECAST_CACHE_VERSION,
    fetchedAt,
    place,
    hours: hours.filter((hour) => hour.end > fetchedAt).slice(0, FORECAST_POLICY.keepHours),
  };
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function isHour(v: unknown): v is ForecastHour {
  const h = v as Partial<ForecastHour> | null;
  return (
    h !== null &&
    typeof h === 'object' &&
    finite(h.start) &&
    finite(h.end) &&
    h.end > h.start &&
    finite(h.windMph) &&
    finite(h.temperatureF) &&
    (h.windFromDeg === null || finite(h.windFromDeg))
  );
}

/** The cache file's contents, or null if missing, corrupt or from another version. */
export function parseCachedForecast(text: string | null): CachedForecast | null {
  if (!text) return null;
  let value: Partial<CachedForecast>;
  try {
    value = JSON.parse(text) as Partial<CachedForecast>;
  } catch {
    return null;
  }
  if (
    value?.version !== FORECAST_CACHE_VERSION ||
    !finite(value.fetchedAt) ||
    !finite(value.place?.lat) ||
    !finite(value.place?.lon) ||
    !Array.isArray(value.hours) ||
    !value.hours.every(isHour)
  ) {
    return null;
  }
  return value as CachedForecast;
}

/**
 * The forecast hour that covers `now` at `place`, or null: no forecast, too far
 * from where it was fetched, or every cached hour has ended. Never an old hour
 * shown as the current one.
 */
export function currentHour(
  forecast: CachedForecast | null,
  place: LatLon | null,
  now: number,
): ForecastHour | null {
  if (!forecast || !place) return null;
  if (distanceMeters(forecast.place, place) > FORECAST_POLICY.maxDistanceMeters) return null;
  return forecast.hours.find((hour) => hour.start <= now && now < hour.end) ?? null;
}

/** True when the forecast is older than the refresh interval (shown with its age). */
export function isOutdated(forecast: CachedForecast, now: number): boolean {
  return positionAge(forecast.fetchedAt, now) >= FORECAST_POLICY.refreshAfterMs;
}

/** Whether to try NWS now: nothing usable, outdated, or you've moved. */
export function needsRefresh(forecast: CachedForecast | null, place: LatLon, now: number): boolean {
  if (!forecast) return true;
  if (isOutdated(forecast, now)) return true;
  if (distanceMeters(forecast.place, place) > FORECAST_POLICY.refreshDistanceMeters) return true;
  return currentHour(forecast, place, now) === null;
}

export type LastAttempt = { at: number; ok: boolean } | null;

/** Whether enough time has passed since the last attempt to try again. */
export function mayAttempt(last: LastAttempt, now: number): boolean {
  if (!last) return true;
  const gap = last.ok ? FORECAST_POLICY.minAttemptGapMs : FORECAST_POLICY.retryAfterFailureMs;
  return positionAge(last.at, now) >= gap;
}
