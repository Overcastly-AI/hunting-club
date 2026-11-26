import { useEffect, useMemo, useRef, useState } from 'react';

import type { LatLon } from '../domain/location';
import { readDocument, writeDocument } from '../storage/documents';
import { weatherDisplay, type WeatherDisplay } from './display';
import {
  forecastToCache,
  mayAttempt,
  needsRefresh,
  parseCachedForecast,
  type LastAttempt,
} from './forecast';
import { fetchForecastHours } from './nwsClient';
import type { CachedForecast } from './types';

/** The forecast cache: documents/weather/forecast.json. */
const CACHE_FOLDER = 'weather';
const CACHE_FILE = 'forecast.json';

/**
 * Wind and temperature for `place` at `now`, for the conditions panel and your
 * scent cone. Reads the cached forecast at start so it works offline, and
 * refreshes from NWS when it can (outdated, moved, or nothing cached). Shows
 * "—" whenever no cached hour covers now at this place.
 */
export function useConditions(place: LatLon | null, now: number): WeatherDisplay {
  const [forecast, setForecast] = useState<CachedForecast | null>(null);
  const [loaded, setLoaded] = useState(false);
  const inFlight = useRef(false);
  const lastAttempt = useRef<LastAttempt>(null);

  useEffect(() => {
    let cancelled = false;
    void readDocument(CACHE_FOLDER, CACHE_FILE).then((text) => {
      if (cancelled) return;
      setForecast((current) => current ?? parseCachedForecast(text));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded || !place || inFlight.current) return;
    if (!needsRefresh(forecast, place, now) || !mayAttempt(lastAttempt.current, now)) return;
    inFlight.current = true;
    const startedAt = Date.now();
    void fetchForecastHours(place).then(async (outcome) => {
      inFlight.current = false;
      lastAttempt.current = { at: startedAt, ok: outcome.kind === 'ok' };
      if (outcome.kind !== 'ok') return;
      const next = forecastToCache(outcome.hours, place, Date.now());
      setForecast(next);
      try {
        await writeDocument(CACHE_FOLDER, CACHE_FILE, JSON.stringify(next));
      } catch {
        // The forecast still shows this session; it just won't survive a restart.
      }
    });
  }, [loaded, place, now, forecast]);

  return useMemo(() => weatherDisplay(forecast, place, now), [forecast, place, now]);
}
