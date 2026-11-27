import { DAY_MS, HOUR_MS, MINUTE_MS, SECOND_MS } from '../time';
import {
  CLOCK_SKEW_TOLERANCE_MS,
  FRESHNESS_THRESHOLDS_MS,
  NOT_HEARD,
  TIME_UNKNOWN,
  classifyFreshness,
  describeAge,
  describeFreshness,
  formatDuration,
  pluralize,
  positionAge,
} from '../freshness';

const NOW = Date.parse('2026-11-30T19:00:00Z');

describe('classifyFreshness', () => {
  it('uses the spec thresholds: solid under 2 min, dashed to 10 min, faded after', () => {
    expect(FRESHNESS_THRESHOLDS_MS).toEqual({ fresh: 2 * MINUTE_MS, stale: 10 * MINUTE_MS });
    expect(classifyFreshness(0)).toBe('fresh');
    expect(classifyFreshness(2 * MINUTE_MS - 1)).toBe('fresh');
    expect(classifyFreshness(2 * MINUTE_MS)).toBe('stale');
    expect(classifyFreshness(10 * MINUTE_MS - 1)).toBe('stale');
    expect(classifyFreshness(10 * MINUTE_MS)).toBe('faded');
    expect(classifyFreshness(6 * HOUR_MS)).toBe('faded');
  });
});

describe('positionAge', () => {
  it('never goes negative when a timestamp is ahead of the phone clock', () => {
    expect(positionAge(1_000, 500)).toBe(0);
    expect(positionAge(500, 1_000)).toBe(500);
  });
});

describe('pluralize', () => {
  it('uses the singular for one only', () => {
    expect(pluralize(1, 'radio')).toBe('1 radio');
    expect(pluralize(0, 'radio')).toBe('0 radios');
    expect(pluralize(3, 'radio')).toBe('3 radios');
  });
});

describe('formatDuration', () => {
  it.each([
    [-5 * SECOND_MS, '0s', '0 seconds'],
    [12 * SECOND_MS, '12s', '12 seconds'],
    [1 * SECOND_MS, '1s', '1 second'],
    [15 * MINUTE_MS, '15 min', '15 minutes'],
    [2 * HOUR_MS + 59 * MINUTE_MS, '2 hr', '2 hours'],
    [DAY_MS, '1 day', '1 day'],
    [3 * DAY_MS + HOUR_MS, '3 days', '3 days'],
  ])('describes %d ms', (ms, short, spoken) => {
    expect(formatDuration(ms)).toEqual({ short, spoken });
  });
});

describe('describeAge', () => {
  it.each([
    [0, 'Just now', 'just now'],
    [59_999, 'Just now', 'just now'],
    [-30_000, 'Just now', 'just now'],
    [1 * MINUTE_MS, '1 min ago', '1 minute ago'],
    [2 * MINUTE_MS + 30_000, '2 min ago', '2 minutes ago'],
    [60 * MINUTE_MS, '1 hr ago', '1 hour ago'],
    [3 * HOUR_MS, '3 hr ago', '3 hours ago'],
    [DAY_MS, '1 day ago', '1 day ago'],
  ])('describes %d ms', (age, short, spoken) => {
    expect(describeAge(age)).toEqual({ short, spoken });
  });

  it('counts seconds when asked', () => {
    expect(describeAge(12 * SECOND_MS, { seconds: true })).toEqual({
      short: '12s ago',
      spoken: '12 seconds ago',
    });
    expect(describeAge(3 * MINUTE_MS, { seconds: true }).short).toBe('3 min ago');
  });
});

describe('describeFreshness', () => {
  it('reads like the marker plate: "2 min ago"', () => {
    expect(describeFreshness(NOW - 2 * MINUTE_MS - 5_000, NOW)).toEqual({
      freshness: 'stale',
      ageMs: 2 * MINUTE_MS + 5_000,
      short: '2 min ago',
      spoken: '2 minutes ago',
    });
    expect(describeFreshness(NOW - 20_000, NOW)).toMatchObject({
      freshness: 'fresh',
      short: 'Just now',
    });
    expect(describeFreshness(NOW - 3 * HOUR_MS, NOW)).toMatchObject({
      freshness: 'faded',
      short: '3 hr ago',
    });
  });

  it('reads like the mesh line: "heard 12s ago"', () => {
    expect(describeFreshness(NOW - 12_000, NOW, 'heard')).toEqual({
      freshness: 'fresh',
      ageMs: 12_000,
      short: 'heard 12s ago',
      spoken: 'heard 12 seconds ago',
    });
    expect(describeFreshness(NOW - 4 * MINUTE_MS, NOW, 'heard').short).toBe('heard 4 min ago');
  });

  it('switches state exactly at the shared thresholds', () => {
    expect(describeFreshness(NOW - FRESHNESS_THRESHOLDS_MS.fresh + 1, NOW).freshness).toBe('fresh');
    expect(describeFreshness(NOW - FRESHNESS_THRESHOLDS_MS.fresh, NOW).freshness).toBe('stale');
    expect(describeFreshness(NOW - FRESHNESS_THRESHOLDS_MS.stale, NOW).freshness).toBe('faded');
  });

  it('treats a small clock skew (heard time slightly in the future) as just now', () => {
    expect(describeFreshness(NOW + 20_000, NOW)).toEqual({
      freshness: 'fresh',
      ageMs: 0,
      short: 'Just now',
      spoken: 'just now',
    });
    expect(describeFreshness(NOW + CLOCK_SKEW_TOLERANCE_MS, NOW).freshness).toBe('fresh');
  });

  it('never shows a time far in the future as live', () => {
    expect(describeFreshness(NOW + CLOCK_SKEW_TOLERANCE_MS + 1, NOW)).toEqual({
      freshness: 'stale',
      ageMs: null,
      ...TIME_UNKNOWN,
    });
    expect(describeFreshness(NOW + DAY_MS, NOW, 'heard').short).toBe('Time unknown');
  });

  it('says "Not heard yet" with no time at all', () => {
    for (const missing of [null, undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(describeFreshness(missing, NOW)).toEqual({
        freshness: 'faded',
        ageMs: null,
        ...NOT_HEARD,
      });
    }
  });
});
