import Constants from 'expo-constants';

import type { LatLon } from '../domain/location';
import { parseHourly, parsePoints, pointsUrl } from './nws';
import type { ForecastHour } from './types';

/**
 * NWS asks every client for a User-Agent. Ours names the app only: no contact
 * details or anything about the user. The phone calls NWS directly; nothing
 * goes through our backend.
 */
export const NWS_USER_AGENT = `HuntClubMesh/${Constants.expoConfig?.version ?? '0'}`;

const REQUEST_TIMEOUT_MS = 15_000;

export type FetchOutcome =
  | { kind: 'ok'; hours: ForecastHour[] }
  /** NWS has no forecast here (outside the US): /points answers 404. */
  | { kind: 'outsideCoverage' }
  /** Offline, timed out, NWS error or a response we couldn't read. */
  | { kind: 'failed' };

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

async function getJson(fetchImpl: Fetch, url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetchImpl(url, {
      headers: { Accept: 'application/geo+json', 'User-Agent': NWS_USER_AGENT },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** The hourly forecast for `place` from api.weather.gov. Never throws. */
export async function fetchForecastHours(
  place: LatLon,
  fetchImpl: Fetch = fetch,
): Promise<FetchOutcome> {
  try {
    const points = await getJson(fetchImpl, pointsUrl(place));
    if (points.status === 404) return { kind: 'outsideCoverage' };
    if (!points.ok) return { kind: 'failed' };
    const hourlyUrl = parsePoints(await points.json());
    if (!hourlyUrl) return { kind: 'failed' };

    const hourly = await getJson(fetchImpl, hourlyUrl);
    if (!hourly.ok) return { kind: 'failed' };
    const hours = parseHourly(await hourly.json());
    return hours.length > 0 ? { kind: 'ok', hours } : { kind: 'failed' };
  } catch {
    return { kind: 'failed' };
  }
}
