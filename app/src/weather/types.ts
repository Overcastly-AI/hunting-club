import type { LatLon } from '@huntclub/mesh';

/** One forecast hour for the conditions panel and scent cone. */
export type ForecastHour = {
  /** Start and end of the hour, epoch ms. */
  start: number;
  end: number;
  /** Sustained wind speed, mph. */
  windMph: number;
  /** Where the wind blows from, degrees clockwise from north; null when calm or not given. */
  windFromDeg: number | null;
  temperatureF: number;
};

/** The forecast kept on the phone so the map works offline after the morning sync. */
export type CachedForecast = {
  version: typeof FORECAST_CACHE_VERSION;
  /** When the phone fetched it, epoch ms. */
  fetchedAt: number;
  /** The place it was fetched for. */
  place: LatLon;
  hours: ForecastHour[];
};

export const FORECAST_CACHE_VERSION = 1;
