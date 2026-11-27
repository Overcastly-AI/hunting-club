/**
 * The conditions readout strip (sunrise, sunset, wind, temperature) and the
 * "2 h 14 min until sunset" line: the one wording for the phone's map, the
 * admin's My club and the site hero. Pure and offline: sunrise and sunset are
 * computed on the device (sun.ts); wind and temperature are whatever the
 * caller already holds (the phone's cached forecast), and anything missing is
 * UNKNOWN_VALUE, never a crash.
 *
 * Rule: sunrise and sunset only. Never legal shooting hours, first or last light.
 */
import { degreesToCompassPoint, downwindBearing } from './compass';
import { formatClockTime } from './clock';
import { pluralize, type Wording } from './freshness';
import { SUN, type SunApi } from './sun';
import { HOUR_MS, MINUTE_MS } from './time';

/** Shown for any condition that isn't known (no fix, no forecast, outside the US). */
export const UNKNOWN_VALUE = '—';
/** What screen readers say instead of UNKNOWN_VALUE. */
export const UNKNOWN_SPOKEN = 'not known';
/** Wind that rounds to 0 mph. */
export const CALM = 'Calm';
/** Sunrise and sunset on a polar day (the sun never sets) and a polar night (it never rises). */
export const SUN_UP_ALL_DAY = 'Up all day';
export const SUN_DOWN_ALL_DAY = 'Down all day';

const UNKNOWN: Wording = { short: UNKNOWN_VALUE, spoken: UNKNOWN_SPOKEN };

const known = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export type WindReadout = Wording & {
  /** Where the wind blows from (for the scent cone); null when calm or unknown. */
  fromDeg: number | null;
  /** Where the "blowing toward" arrow points; null when calm or unknown. */
  towardDeg: number | null;
};

/** "NW 6 mph" ("6 mph from NW, blowing toward SE"), "Calm", "6 mph" with no direction, or "—". */
export function windReadout(
  mph: number | null | undefined,
  fromDeg: number | null | undefined,
): WindReadout {
  if (!known(mph) || mph < 0) return { ...UNKNOWN, fromDeg: null, towardDeg: null };
  const speed = Math.round(mph);
  if (speed === 0) return { short: CALM, spoken: 'calm', fromDeg: null, towardDeg: null };
  if (!known(fromDeg)) {
    const short = `${speed} mph`;
    return { short, spoken: short, fromDeg: null, towardDeg: null };
  }
  const towardDeg = downwindBearing(fromDeg);
  const from = degreesToCompassPoint(fromDeg);
  return {
    short: `${from} ${speed} mph`,
    spoken: `${speed} mph from ${from}, blowing toward ${degreesToCompassPoint(towardDeg)}`,
    fromDeg,
    towardDeg,
  };
}

/** "34°F" or "—". */
export function temperatureReadout(fahrenheit: number | null | undefined): Wording {
  if (!known(fahrenheit)) return UNKNOWN;
  const short = `${Math.round(fahrenheit)}°F`;
  return { short, spoken: short };
}

/**
 * "2 h 14 min until sunset" ("2 hours 14 minutes until sunset" spoken), rounded
 * up to the minute so it never says 0. Null once the sun has set.
 */
export function untilSunset(sunset: Date, now: number): Wording | null {
  const left = sunset.getTime() - now;
  if (!Number.isFinite(left) || left <= 0) return null;
  const totalMinutes = Math.ceil(left / MINUTE_MS);
  const hours = Math.floor(totalMinutes / (HOUR_MS / MINUTE_MS));
  const minutes = totalMinutes % (HOUR_MS / MINUTE_MS);
  const short = [hours ? `${hours} h` : '', minutes ? `${minutes} min` : ''].filter(Boolean);
  const spoken = [
    hours ? pluralize(hours, 'hour') : '',
    minutes ? pluralize(minutes, 'minute') : '',
  ];
  return {
    short: `${short.join(' ')} until sunset`,
    spoken: `${spoken.filter(Boolean).join(' ')} until sunset`,
  };
}

export type SunReadout = {
  sunrise: Wording;
  sunset: Wording;
  /** Null after sunset, on a polar day or night, and with no place. */
  untilSunset: Wording | null;
};

/** Sunrise and sunset today at `place`, offline. No place yet: "—" for both. */
export function sunReadout(
  place: { lat: number; lon: number } | null | undefined,
  now: number,
  sun: SunApi = SUN,
): SunReadout {
  if (!place || !known(place.lat) || !known(place.lon) || !known(now)) {
    return { sunrise: UNKNOWN, sunset: UNKNOWN, untilSunset: null };
  }
  const times = sun.sunTimes(sun.localCalendarDay(new Date(now)), place.lat, place.lon);
  if (times.kind !== 'normal') {
    const short = times.kind === 'polarDay' ? SUN_UP_ALL_DAY : SUN_DOWN_ALL_DAY;
    const all: Wording = { short, spoken: short.toLowerCase() };
    return { sunrise: all, sunset: all, untilSunset: null };
  }
  const clock = (date: Date): Wording => ({
    short: formatClockTime(date),
    spoken: formatClockTime(date),
  });
  return {
    sunrise: clock(times.sunrise),
    sunset: clock(times.sunset),
    untilSunset: untilSunset(times.sunset, now),
  };
}

/** What the strip reads from: where you are, the time, and the forecast hour if one covers now. */
export type ConditionsInput = {
  place: { lat: number; lon: number } | null | undefined;
  now: number;
  windMph?: number | null | undefined;
  windFromDeg?: number | null | undefined;
  temperatureF?: number | null | undefined;
  sun?: SunApi;
};

export type ConditionsReadout = SunReadout & { wind: WindReadout; temperature: Wording };

/** The four-cell strip plus the sunset countdown. */
export function conditionsReadout(input: ConditionsInput): ConditionsReadout {
  return {
    ...sunReadout(input.place, input.now, input.sun),
    wind: windReadout(input.windMph, input.windFromDeg),
    temperature: temperatureReadout(input.temperatureF),
  };
}
