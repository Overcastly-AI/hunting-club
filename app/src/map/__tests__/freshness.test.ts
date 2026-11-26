import { MINUTES } from '../../test-utils/mapFixtures';
import { FRESHNESS_THRESHOLDS_MS, classifyFreshness, describeAge, positionAge } from '../freshness';

describe('classifyFreshness', () => {
  it('uses the spec thresholds: solid under 2 min, dashed to 10 min, faded after', () => {
    expect(FRESHNESS_THRESHOLDS_MS).toEqual({ fresh: 2 * MINUTES, stale: 10 * MINUTES });
    expect(classifyFreshness(0)).toBe('fresh');
    expect(classifyFreshness(2 * MINUTES - 1)).toBe('fresh');
    expect(classifyFreshness(2 * MINUTES)).toBe('stale');
    expect(classifyFreshness(10 * MINUTES - 1)).toBe('stale');
    expect(classifyFreshness(10 * MINUTES)).toBe('faded');
    expect(classifyFreshness(6 * 60 * MINUTES)).toBe('faded');
  });
});

describe('positionAge', () => {
  it('never goes negative when a timestamp is ahead of the phone clock', () => {
    expect(positionAge(1_000, 500)).toBe(0);
    expect(positionAge(500, 1_000)).toBe(500);
  });
});

describe('describeAge', () => {
  it.each([
    [0, 'Just now', 'just now'],
    [59_999, 'Just now', 'just now'],
    [1 * MINUTES, '1 min ago', '1 minute ago'],
    [2 * MINUTES + 30_000, '2 min ago', '2 minutes ago'],
    [60 * MINUTES, '1 hr ago', '1 hour ago'],
    [3 * 60 * MINUTES, '3 hr ago', '3 hours ago'],
    [24 * 60 * MINUTES, '1 day ago', '1 day ago'],
  ])('describes %d ms', (age, short, spoken) => {
    expect(describeAge(age)).toEqual({ short, spoken });
  });
});
