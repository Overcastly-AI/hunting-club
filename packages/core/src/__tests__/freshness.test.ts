import { MINUTE_MS } from '../config';
import { FRESHNESS_THRESHOLDS_MS, classifyFreshness, positionAge } from '../freshness';

const MINUTES = MINUTE_MS;

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
