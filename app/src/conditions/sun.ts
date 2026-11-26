import { DAY_MS } from '../domain/time';

/**
 * Sunrise and sunset computed on the device, offline, with the NOAA/Wikipedia
 * "sunrise equation" (accurate to about a minute at hunting latitudes).
 *
 * Rule: never show legal shooting hours. This module gives sunrise and sunset only.
 */

const DEG = Math.PI / 180;
const J1970 = 2440587.5;
const J2000 = 2451545;
/** Standard altitude of the sun's centre at sunrise/sunset: refraction plus solar radius. */
const SUN_ALTITUDE_DEG = -0.833;
const EARTH_OBLIQUITY_DEG = 23.4397;

export type CalendarDay = { year: number; month: number; day: number };

export type SunTimes =
  | { kind: 'normal'; sunrise: Date; sunset: Date }
  /** The sun does not set on this day (far north in summer). */
  | { kind: 'polarDay' }
  /** The sun does not rise on this day (far north in winter). */
  | { kind: 'polarNight' };

const toJulian = (ms: number) => ms / DAY_MS + J1970;
const fromJulian = (jd: number) => new Date((jd - J1970) * DAY_MS);

/**
 * Sunrise and sunset for a calendar day at a place.
 * `day` is the local calendar date at the place; longitude is east-positive.
 */
export function sunTimes(day: CalendarDay, lat: number, lon: number): SunTimes {
  const midnightUtc = toJulian(Date.UTC(day.year, day.month - 1, day.day));
  const n = Math.ceil(midnightUtc - J2000 + 0.0008);
  const meanSolarTime = n - lon / 360;
  const meanAnomaly = (357.5291 + 0.98560028 * meanSolarTime) % 360;
  const m = meanAnomaly * DEG;
  const center = 1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m);
  const eclipticLon = ((meanAnomaly + center + 180 + 102.9372) % 360) * DEG;
  const transit = J2000 + meanSolarTime + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * eclipticLon);
  const sinDecl = Math.sin(eclipticLon) * Math.sin(EARTH_OBLIQUITY_DEG * DEG);
  const cosDecl = Math.cos(Math.asin(sinDecl));
  const phi = lat * DEG;
  const cosHourAngle =
    (Math.sin(SUN_ALTITUDE_DEG * DEG) - Math.sin(phi) * sinDecl) / (Math.cos(phi) * cosDecl);

  if (cosHourAngle < -1) return { kind: 'polarDay' };
  if (cosHourAngle > 1) return { kind: 'polarNight' };

  const halfDay = Math.acos(cosHourAngle) / DEG / 360;
  return {
    kind: 'normal',
    sunrise: fromJulian(transit - halfDay),
    sunset: fromJulian(transit + halfDay),
  };
}

/** The device's local calendar day for a moment in time. */
export function localCalendarDay(date: Date): CalendarDay {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

/** Local clock time such as "6:52 AM". */
export function formatClockTime(date: Date): string {
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
}
