import type { Placement } from '@huntclub/core';
import { CheckInMode, type LatLon } from '@huntclub/mesh';
import type { Polygon, StandType } from '@huntclub/shared';

import { distanceMeters } from '../map/geo';

/** What the hunter has picked so far on the Check In screen. */
export type CheckInDraft = {
  mode: CheckInMode;
  /** Our location, if known. Needed for a spot; shared with others in the other modes when known. */
  pin?: LatLon;
  spotName?: string;
  standId?: number;
  areaId?: number;
};

export type DraftResult = { ok: true; placement: Placement } | { ok: false; missing: string };

/**
 * Turns the draft into core's Placement, or says what is still missing.
 * Core re-checks the rules when it sends; this only decides whether the slide is ready.
 */
export function placementFrom(draft: CheckInDraft): DraftResult {
  const pin = draft.pin ? { pin: draft.pin } : {};
  switch (draft.mode) {
    case CheckInMode.Spot: {
      if (!draft.pin) return { ok: false, missing: 'Waiting for your location' };
      const name = draft.spotName?.trim();
      return {
        ok: true,
        placement: { mode: CheckInMode.Spot, pin: draft.pin, ...(name ? { name } : {}) },
      };
    }
    case CheckInMode.Moving:
      return { ok: true, placement: { mode: CheckInMode.Moving, ...pin } };
    case CheckInMode.Stand:
      return draft.standId
        ? { ok: true, placement: { mode: CheckInMode.Stand, standId: draft.standId, ...pin } }
        : { ok: false, missing: 'Pick a stand' };
    case CheckInMode.Area:
      return draft.areaId
        ? { ok: true, placement: { mode: CheckInMode.Area, areaId: draft.areaId, ...pin } }
        : { ok: false, missing: 'Pick an area' };
  }
}

/** A club stand as the Check In screen lists it. */
export type ClubStand = {
  meshId: number;
  name: string;
  position: LatLon;
  /** Tree stand, ladder or ground blind (the club's stand list); drawn as its icon. */
  type?: StandType;
  occupiedBy?: string;
};
/** A club area as Check In lists it; its outline is drawn dotted on the map when known. */
export type ClubArea = { meshId: number; name: string; boundary?: Polygon };

/** Open stands first, nearest first when we know where we are; occupied stands last. */
export function sortStands(stands: readonly ClubStand[], here: LatLon | undefined): ClubStand[] {
  const distance = (s: ClubStand) => (here ? distanceMeters(here, s.position) : 0);
  return [...stands].sort(
    (a, b) => Number(!!a.occupiedBy) - Number(!!b.occupiedBy) || distance(a) - distance(b),
  );
}
