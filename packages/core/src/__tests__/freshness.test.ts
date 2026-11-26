import { MINUTE_MS } from '../config';
import { FRESHNESS_THRESHOLDS_MS, classifyFreshness, positionAge } from '../freshness';

describe('classifyFreshness', () => {
  it('uses the spec thresholds: solid under 2 min, dashed to 10 min, faded after', () => {
    expect(FRESHNESS_THRESHOLDS_MS).toEqual({ fresh: 2 * MINUTE_MS, stale: 10 * MINUTE_MS });
    expect(classifyFreshness(0)).toBe('fresh');
    expect(classifyFreshness(2 * MINUTE_MS - 1)).toBe('fresh');
    expect(classifyFreshness(2 * MINUTE_MS)).toBe('stale');
    expect(classifyFreshness(10 * MINUTE_MS - 1)).toBe('stale');
    expect(classifyFreshness(10 * MINUTE_MS)).toBe('faded');
    expect(classifyFreshness(6 * 60 * MINUTE_MS)).toBe('faded');
  });
});

describe('positionAge', () => {
  it('never goes negative when a timestamp is ahead of the phone clock', () => {
    expect(positionAge(1_000, 500)).toBe(0);
    expect(positionAge(500, 1_000)).toBe(500);
  });
});
