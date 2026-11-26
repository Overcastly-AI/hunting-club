import { MINUTE_MS } from '../../domain/time';
import { FRESHNESS_THRESHOLDS_MS, classifyFreshness } from '../freshness';

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
