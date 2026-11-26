import { MINUTE_MS } from '../config';
import { localCalendarDay, sunTimes } from '../sun';

function expectNear(actual: Date, expectedIso: string, toleranceMinutes = 2) {
  const diff = Math.abs(actual.getTime() - Date.parse(expectedIso));
  expect(diff).toBeLessThanOrEqual(toleranceMinutes * MINUTE_MS);
}

function normal(result: ReturnType<typeof sunTimes>) {
  if (result.kind !== 'normal') throw new Error(`expected normal day, got ${result.kind}`);
  return result;
}

// Reference times computed independently with the Python `astral` library (3.2).
describe('sunTimes', () => {
  it('matches the reference for Washington, DC at the June solstice', () => {
    const { sunrise, sunset } = normal(
      sunTimes({ year: 2024, month: 6, day: 21 }, 38.8977, -77.0365),
    );
    expectNear(sunrise, '2024-06-21T09:43:25Z'); // 5:43 AM EDT
    expectNear(sunset, '2024-06-22T00:36:40Z'); // 8:37 PM EDT, next day in UTC
  });

  it('matches the reference for central Pennsylvania in deer season', () => {
    const { sunrise, sunset } = normal(sunTimes({ year: 2026, month: 11, day: 30 }, 40.79, -77.86));
    expectNear(sunrise, '2026-11-30T12:15:37Z'); // 7:15 AM EST
    expectNear(sunset, '2026-11-30T21:44:27Z'); // 4:44 PM EST
  });

  it('matches the reference for Bozeman, Montana at the December solstice', () => {
    const { sunrise, sunset } = normal(
      sunTimes({ year: 2025, month: 12, day: 21 }, 45.68, -111.04),
    );
    expectNear(sunrise, '2025-12-21T15:02:23Z'); // 8:02 AM MST
    expectNear(sunset, '2025-12-21T23:42:39Z'); // 4:42 PM MST
  });

  it('matches the reference for Atlanta in October', () => {
    const { sunrise, sunset } = normal(sunTimes({ year: 2026, month: 10, day: 15 }, 33.75, -84.39));
    expectNear(sunrise, '2026-10-15T11:42:43Z'); // 7:42 AM EDT
    expectNear(sunset, '2026-10-15T23:03:20Z'); // 7:03 PM EDT
  });

  it('reports polar day and polar night in the far north', () => {
    expect(sunTimes({ year: 2026, month: 6, day: 21 }, 71.29, -156.79).kind).toBe('polarDay');
    expect(sunTimes({ year: 2026, month: 12, day: 21 }, 71.29, -156.79).kind).toBe('polarNight');
  });
});

describe('localCalendarDay', () => {
  it('uses the device calendar date', () => {
    expect(localCalendarDay(new Date(2026, 10, 30, 23, 59))).toEqual({
      year: 2026,
      month: 11,
      day: 30,
    });
  });
});
