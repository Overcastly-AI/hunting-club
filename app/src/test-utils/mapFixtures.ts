import { HOUR_MS, MINUTE_MS, untilSunset } from '@huntclub/shared';
import type { HunterOnMap, OpenStandOnMap } from '../map/types';

export const NOW = Date.UTC(2026, 10, 26, 12, 0, 0);

/** A hunter heard `minutesAgo` before NOW; override any field. */
export function hunterFixture(
  minutesAgo: number,
  overrides: Partial<HunterOnMap> = {},
): HunterOnMap {
  return {
    id: 'node-1',
    displayName: 'Dale',
    initials: 'DM',
    position: { lat: 40.79, lon: -77.86 },
    heardAt: NOW - minutesAgo * MINUTE_MS,
    place: { kind: 'stand', name: 'Creek Stand' },
    ...overrides,
  };
}

export const openStandFixture: OpenStandOnMap = {
  id: 'stand-ridge',
  name: 'Ridge Stand',
  type: 'ladder',
  position: { lat: 40.8, lon: -77.85 },
};

/** "2 h 14 min until sunset", counted from NOW. */
export const UNTIL_SUNSET_FIXTURE = untilSunset(new Date(NOW + 2 * HOUR_MS + 14 * MINUTE_MS), NOW);
