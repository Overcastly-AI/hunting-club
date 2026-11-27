import { formatClockTime } from '../clock';
import {
  CALM,
  SUN_DOWN_ALL_DAY,
  SUN_UP_ALL_DAY,
  UNKNOWN_SPOKEN,
  UNKNOWN_VALUE,
  conditionsReadout,
  sunReadout,
  temperatureReadout,
  untilSunset,
  windReadout,
} from '../readout';
import type { SunApi, SunTimes } from '../sun';
import { HOUR_MS, MINUTE_MS, SECOND_MS } from '../time';

const UNKNOWN = { short: UNKNOWN_VALUE, spoken: UNKNOWN_SPOKEN };
const PLACE = { lat: 40.79, lon: -77.86 };
const SUNRISE = new Date('2026-11-30T12:15:00Z');
const SUNSET = new Date('2026-11-30T21:44:00Z');

/** A fixed sun, so the tests don't depend on the machine's time zone. */
const fixedSun = (times: SunTimes): SunApi => ({
  sunTimes: () => times,
  localCalendarDay: () => ({ year: 2026, month: 11, day: 30 }),
});
const NORMAL = fixedSun({ kind: 'normal', sunrise: SUNRISE, sunset: SUNSET });

describe('windReadout', () => {
  it('reads the wind by where it blows from, with the downwind bearing', () => {
    expect(windReadout(6.4, 315)).toEqual({
      short: 'NW 6 mph',
      spoken: '6 mph from NW, blowing toward SE',
      fromDeg: 315,
      towardDeg: 135,
    });
  });

  it('rounds the speed and says Calm with no arrow at 0 mph', () => {
    expect(windReadout(7.6, 270).short).toBe('W 8 mph');
    expect(windReadout(0.4, 270)).toEqual({
      short: CALM,
      spoken: 'calm',
      fromDeg: null,
      towardDeg: null,
    });
  });

  it('shows the speed alone when there is no direction', () => {
    expect(windReadout(8, null)).toEqual({
      short: '8 mph',
      spoken: '8 mph',
      fromDeg: null,
      towardDeg: null,
    });
    expect(windReadout(8, Number.NaN).short).toBe('8 mph');
  });

  it('is an em dash, never a crash, when the speed is missing or nonsense', () => {
    for (const mph of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, -3]) {
      expect(windReadout(mph, 200)).toEqual({ ...UNKNOWN, fromDeg: null, towardDeg: null });
    }
  });
});

describe('temperatureReadout', () => {
  it('rounds to whole degrees Fahrenheit', () => {
    expect(temperatureReadout(33.6)).toEqual({ short: '34°F', spoken: '34°F' });
    expect(temperatureReadout(-4.2).short).toBe('-4°F');
    expect(temperatureReadout(0).short).toBe('0°F');
  });

  it('is an em dash when missing', () => {
    expect(temperatureReadout(null)).toEqual(UNKNOWN);
    expect(temperatureReadout(undefined)).toEqual(UNKNOWN);
    expect(temperatureReadout(Number.NaN)).toEqual(UNKNOWN);
  });
});

describe('untilSunset', () => {
  const sunset = SUNSET.getTime();

  it('counts hours and minutes: "2 h 14 min until sunset"', () => {
    expect(untilSunset(SUNSET, sunset - (2 * HOUR_MS + 14 * MINUTE_MS))).toEqual({
      span: '2 h 14 min',
      short: '2 h 14 min until sunset',
      spoken: '2 hours 14 minutes until sunset',
    });
  });

  it('drops a zero part and uses the singular', () => {
    expect(untilSunset(SUNSET, sunset - HOUR_MS)?.short).toBe('1 h until sunset');
    expect(untilSunset(SUNSET, sunset - 45 * MINUTE_MS)?.short).toBe('45 min until sunset');
    expect(untilSunset(SUNSET, sunset - (HOUR_MS + MINUTE_MS))?.spoken).toBe(
      '1 hour 1 minute until sunset',
    );
  });

  it('rounds up so it never says 0 min before sunset', () => {
    expect(untilSunset(SUNSET, sunset - 10 * SECOND_MS)?.short).toBe('1 min until sunset');
    expect(untilSunset(SUNSET, sunset - (2 * HOUR_MS + 13 * MINUTE_MS + 1))?.short).toBe(
      '2 h 14 min until sunset',
    );
  });

  it('is null at and after sunset, and for a bad date', () => {
    expect(untilSunset(SUNSET, sunset)).toBeNull();
    expect(untilSunset(SUNSET, sunset + MINUTE_MS)).toBeNull();
    expect(untilSunset(new Date(Number.NaN), sunset)).toBeNull();
  });
});

describe('sunReadout', () => {
  it('formats sunrise and sunset as local clock times and counts down to sunset', () => {
    const now = SUNSET.getTime() - (2 * HOUR_MS + 14 * MINUTE_MS);
    expect(sunReadout(PLACE, now, NORMAL)).toEqual({
      sunrise: { short: formatClockTime(SUNRISE), spoken: formatClockTime(SUNRISE) },
      sunset: { short: formatClockTime(SUNSET), spoken: formatClockTime(SUNSET) },
      untilSunset: {
        span: '2 h 14 min',
        short: '2 h 14 min until sunset',
        spoken: '2 hours 14 minutes until sunset',
      },
    });
  });

  it('still shows the times after sunset, with no countdown', () => {
    const view = sunReadout(PLACE, SUNSET.getTime() + HOUR_MS, NORMAL);
    expect(view.sunset.short).toBe(formatClockTime(SUNSET));
    expect(view.untilSunset).toBeNull();
  });

  it('counts the whole day down before sunrise', () => {
    const view = sunReadout(PLACE, SUNRISE.getTime() - HOUR_MS, NORMAL);
    expect(view.untilSunset?.short).toBe('10 h 29 min until sunset');
  });

  it('handles a polar day and a polar night with no sunrise or sunset', () => {
    expect(sunReadout(PLACE, 1, fixedSun({ kind: 'polarDay' }))).toEqual({
      sunrise: { short: SUN_UP_ALL_DAY, spoken: 'up all day' },
      sunset: { short: SUN_UP_ALL_DAY, spoken: 'up all day' },
      untilSunset: null,
    });
    expect(sunReadout(PLACE, 1, fixedSun({ kind: 'polarNight' })).sunrise.short).toBe(
      SUN_DOWN_ALL_DAY,
    );
  });

  it('computes polar days and nights with the real sun (Svalbard)', () => {
    const svalbard = { lat: 78.22, lon: 15.65 };
    const winter = sunReadout(svalbard, Date.parse('2026-12-15T12:00:00Z'));
    expect(winter).toMatchObject({ sunrise: { short: SUN_DOWN_ALL_DAY }, untilSunset: null });
    const summer = sunReadout(svalbard, Date.parse('2026-06-21T12:00:00Z'));
    expect(summer).toMatchObject({ sunset: { short: SUN_UP_ALL_DAY }, untilSunset: null });
  });

  it('is an em dash with no place, a bad place or a bad clock', () => {
    const none = { sunrise: UNKNOWN, sunset: UNKNOWN, untilSunset: null };
    expect(sunReadout(null, 1, NORMAL)).toEqual(none);
    expect(sunReadout(undefined, 1, NORMAL)).toEqual(none);
    expect(sunReadout({ lat: Number.NaN, lon: 0 }, 1, NORMAL)).toEqual(none);
    expect(sunReadout(PLACE, Number.NaN, NORMAL)).toEqual(none);
  });
});

describe('conditionsReadout', () => {
  it('fills the four cells and the countdown from what the phone already has', () => {
    const view = conditionsReadout({
      place: PLACE,
      now: SUNSET.getTime() - 30 * MINUTE_MS,
      windMph: 6,
      windFromDeg: 315,
      temperatureF: 34,
      sun: NORMAL,
    });
    expect(view.sunrise.short).toBe(formatClockTime(SUNRISE));
    expect(view.wind.short).toBe('NW 6 mph');
    expect(view.temperature.short).toBe('34°F');
    expect(view.untilSunset?.short).toBe('30 min until sunset');
  });

  it('shows an em dash in every cell offline with no fix and no forecast', () => {
    expect(conditionsReadout({ place: null, now: 1 })).toEqual({
      sunrise: UNKNOWN,
      sunset: UNKNOWN,
      untilSunset: null,
      wind: { ...UNKNOWN, fromDeg: null, towardDeg: null },
      temperature: UNKNOWN,
    });
  });
});
