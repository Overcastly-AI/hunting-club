import { HOUR_MS, MINUTE_MS, untilSunset } from '@huntclub/shared';
import type { MapBottomSheetProps } from '../map/components/MapBottomSheet';
import type { HunterOnMap, OpenStandOnMap } from '../map/types';

type SheetCommon = Omit<
  Extract<MapBottomSheetProps, { state: 'notCheckedIn' }>,
  'state' | 'onCheckIn'
>;

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

/** The props every MapBottomSheet takes, for a 390 x 701 map; override any. */
export function sheetFixture(overrides: Partial<SheetCommon> = {}): SheetCommon {
  return {
    mapTop: 47,
    mapHeight: 701,
    detent: 'peek',
    onDetent: jest.fn(),
    reduceMotion: true,
    audience: 'party',
    onAskForHand: jest.fn(),
    onLogHarvest: jest.fn(),
    nearestStand: null,
    onShowStand: jest.fn(),
    hunters: [],
    now: NOW,
    ...overrides,
  };
}
