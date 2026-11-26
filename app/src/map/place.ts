import { CHECK_IN_MODE_KEYS, type CheckInMode } from '@huntclub/mesh';

import { UNNAMED_AREA, UNNAMED_STAND } from './labels';
import type { HunterPlace } from './types';

/** Stand and area names this phone knows, by mesh id (local DB). */
export type PlaceNames = {
  stand?: (meshId: number) => string | undefined;
  area?: (meshId: number) => string | undefined;
};

/** A check-in's mode and ids: someone else's (core MemberCheckIn) or ours (core Placement). */
export type PlaceInput = { mode: CheckInMode; standId?: number; areaId?: number; name?: string };

/** What the map and bottom sheet call a check-in: stand, area or spot name, or On the move. */
export function placeOf(checkIn: PlaceInput, names: PlaceNames = {}): HunterPlace {
  switch (CHECK_IN_MODE_KEYS[checkIn.mode]) {
    case 'stand':
      return {
        kind: 'stand',
        name: (checkIn.standId && names.stand?.(checkIn.standId)) || UNNAMED_STAND,
      };
    case 'area':
      return {
        kind: 'area',
        name: (checkIn.areaId && names.area?.(checkIn.areaId)) || UNNAMED_AREA,
      };
    case 'spot':
      return checkIn.name ? { kind: 'spot', name: checkIn.name } : { kind: 'spot' };
    case 'moving': {
      const areaName = checkIn.areaId ? names.area?.(checkIn.areaId) : undefined;
      return areaName ? { kind: 'moving', areaName } : { kind: 'moving' };
    }
  }
}
