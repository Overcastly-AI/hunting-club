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

/** A clock time as a readout shows and reads it ("5:08 PM"), or "—" when it is not known. */
export function clockReadout(at: Date | number | null | undefined): Wording {
  const ms = at instanceof Date ? at.getTime() : at;
  if (!known(ms)) return UNKNOWN;
  const short = formatClockTime(new Date(ms));
  return { short, spoken: short };
}

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

/** The sunset countdown, and its number alone ("2 h 14 min") for a readout over "until sunset". */
export type UntilSunset = Wording & { span: string };

/** The words under a countdown's `span` on the phone's map sheet. */
export const UNTIL_SUNSET = 'until sunset';

/**
 * "2 h 14 min until sunset" ("2 hours 14 minutes until sunset" spoken), rounded
 * up to the minute so it never says 0. Null once the sun has set.
 */
export function untilSunset(sunset: Date, now: number): UntilSunset | null {
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
  const span = short.join(' ');
  return {
    span,
    short: `${span} ${UNTIL_SUNSET}`,
    spoken: `${spoken.filter(Boolean).join(' ')} ${UNTIL_SUNSET}`,
  };
}

export type SunReadout = {
  sunrise: Wording;
  sunset: Wording;
  /** Null after sunset, on a polar day or night, and with no place. */
  untilSunset: UntilSunset | null;
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
  return {
    sunrise: clockReadout(times.sunrise),
    sunset: clockReadout(times.sunset),
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

/** The strip's four cells, in order, with the word over each (docs/DESIGN.md "Read out"). */
export const READOUT_CELLS = ['sunrise', 'sunset', 'wind', 'temperature'] as const;
export type ReadoutCell = (typeof READOUT_CELLS)[number];
export const READOUT_LABELS: Record<ReadoutCell, string> = {
  sunrise: 'Sunrise',
  sunset: 'Sunset',
  wind: 'Wind from',
  temperature: 'Temp',
};

/** The four-cell strip plus the sunset countdown. */
export function conditionsReadout(input: ConditionsInput): ConditionsReadout {
  return {
    ...sunReadout(input.place, input.now, input.sun),
    wind: windReadout(input.windMph, input.windFromDeg),
    temperature: temperatureReadout(input.temperatureF),
  };
}

/** The word for the time the club's overdue alert goes out (sunset plus the club's grace). */
export const OVERDUE_ALERT_LABEL = 'Overdue at';

/**
 * The one next time for the map's top pill (docs/DESIGN.md "Map chrome"): the sunset countdown
 * while the sun is up, then the overdue time while it is still ahead, then the sunset time.
 * Sunrise and sunset only, never legal shooting hours.
 */
export function nextTimeReadout(
  sun: SunReadout,
  overdueAt: number | undefined,
  now: number,
): Wording {
  if (sun.untilSunset) return sun.untilSunset;
  if (overdueAt !== undefined && overdueAt > now) {
    const at = clockReadout(overdueAt);
    return {
      short: `${OVERDUE_ALERT_LABEL} ${at.short}`,
      spoken: `${OVERDUE_ALERT_LABEL} ${at.spoken}`,
    };
  }
  return {
    short: `${READOUT_LABELS.sunset} ${sun.sunset.short}`,
    spoken: `${READOUT_LABELS.sunset} ${sun.sunset.spoken}`,
  };
}
