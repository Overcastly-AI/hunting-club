import { HOUR_MS, MINUTE_MS } from '../../domain/time';
import { destination } from '../../map/geo';
import { FIXTURE_PLACES, cheyenneCache } from '../../test-utils/nwsFixtures';
import {
  FORECAST_POLICY,
  currentHour,
  forecastToCache,
  mayAttempt,
  needsRefresh,
  parseCachedForecast,
} from '../forecast';

const PLACE = FIXTURE_PLACES.cheyenne;
const FETCHED = Date.parse('2026-11-25T23:30:00-07:00');

describe('forecastToCache', () => {
  it('keeps hours that have not ended, up to keepHours', () => {
    const cache = cheyenneCache(FETCHED);
    expect(cache.hours).toHaveLength(FORECAST_POLICY.keepHours);
    expect(cache.hours[0]!.start).toBe(Date.parse('2026-11-25T23:00:00-07:00'));
    expect(cache).toMatchObject({ version: 1, fetchedAt: FETCHED, place: PLACE });
  });
});

describe('parseCachedForecast', () => {
  it('round-trips the JSON written to the phone', () => {
    const cache = cheyenneCache(FETCHED);
    expect(parseCachedForecast(JSON.stringify(cache))).toEqual(cache);
  });

  it('rejects missing, corrupt and other-version files', () => {
    const cache = cheyenneCache(FETCHED);
    expect(parseCachedForecast(null)).toBeNull();
    expect(parseCachedForecast('{not json')).toBeNull();
    expect(parseCachedForecast(JSON.stringify({ ...cache, version: 2 }))).toBeNull();
    expect(parseCachedForecast(JSON.stringify({ ...cache, place: null }))).toBeNull();
    const badHour = { ...cache.hours[0], windMph: 'ten' };
    expect(parseCachedForecast(JSON.stringify({ ...cache, hours: [badHour] }))).toBeNull();
  });
});

describe('currentHour', () => {
  const cache = cheyenneCache(FETCHED);

  it('picks the hour covering now', () => {
    const now = Date.parse('2026-11-26T01:15:00-07:00');
    expect(currentHour(cache, PLACE, now)?.start).toBe(Date.parse('2026-11-26T01:00:00-07:00'));
  });

  it('works offline hours later, while a cached hour still covers now', () => {
    const now = FETCHED + 12 * HOUR_MS;
    expect(currentHour(cache, PLACE, now)).not.toBeNull();
  });

  it('never shows an ended hour as current', () => {
    const lastEnd = cache.hours[cache.hours.length - 1]!.end;
    expect(currentHour(cache, PLACE, lastEnd)).toBeNull();
    expect(currentHour(cache, PLACE, cache.hours[0]!.start - 1)).toBeNull();
  });

  it('applies within maxDistance of where it was fetched, not beyond', () => {
    const near = destination(PLACE, 90, FORECAST_POLICY.maxDistanceMeters - 100);
    const far = destination(PLACE, 90, FORECAST_POLICY.maxDistanceMeters + 100);
    expect(currentHour(cache, near, FETCHED)).not.toBeNull();
    expect(currentHour(cache, far, FETCHED)).toBeNull();
    expect(currentHour(cache, null, FETCHED)).toBeNull();
    expect(currentHour(null, PLACE, FETCHED)).toBeNull();
  });
});

describe('needsRefresh', () => {
  const cache = cheyenneCache(FETCHED);

  it('refreshes with no cache, after an hour, or after moving', () => {
    expect(needsRefresh(null, PLACE, FETCHED)).toBe(true);
    expect(needsRefresh(cache, PLACE, FETCHED + 10 * MINUTE_MS)).toBe(false);
    expect(needsRefresh(cache, PLACE, FETCHED + HOUR_MS)).toBe(true);
    const moved = destination(PLACE, 0, FORECAST_POLICY.refreshDistanceMeters + 100);
    expect(needsRefresh(cache, moved, FETCHED + 10 * MINUTE_MS)).toBe(true);
  });

  it('refreshes when no cached hour covers now', () => {
    const empty = forecastToCache([], PLACE, FETCHED);
    expect(needsRefresh(empty, PLACE, FETCHED + MINUTE_MS)).toBe(true);
  });
});

describe('mayAttempt', () => {
  it('spaces attempts, and waits longer after a failure', () => {
    const at = FETCHED;
    expect(mayAttempt(null, at)).toBe(true);
    expect(mayAttempt({ at, ok: true }, at + FORECAST_POLICY.minAttemptGapMs - 1)).toBe(false);
    expect(mayAttempt({ at, ok: true }, at + FORECAST_POLICY.minAttemptGapMs)).toBe(true);
    expect(mayAttempt({ at, ok: false }, at + FORECAST_POLICY.minAttemptGapMs)).toBe(false);
    expect(mayAttempt({ at, ok: false }, at + FORECAST_POLICY.retryAfterFailureMs)).toBe(true);
  });
});
