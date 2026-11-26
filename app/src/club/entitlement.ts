import { createContext, useContext } from 'react';

import type { LocalClub } from './store';

/**
 * A club's entitlement as cached on this phone, so club features work offline
 * (docs/SPEC.md, "Clubs and subscriptions"). It comes from the club API's
 * entitlement (subscription status, paid-through date plus grace; one rule,
 * `entitlementFor` in @huntclub/shared) at the last sync.
 */
export type ClubEntitlement = {
  clubId: string;
  clubName: string;
  /** Paid-through date plus grace (epoch ms). Club features freeze after this. */
  featuresUntil: number;
};

/** The cached entitlement of a synced club, or null (never synced, or not paid). */
export function entitlementOf(club: LocalClub): ClubEntitlement | null {
  return club.featuresUntil === null
    ? null
    : { clubId: club.id, clubName: club.name, featuresUntil: club.featuresUntil };
}

/** Null for free users and before a club has synced. Filled by ClubProvider. */
export const ClubEntitlementContext = createContext<ClubEntitlement | null>(null);

export function useClubEntitlement(): ClubEntitlement | null {
  return useContext(ClubEntitlementContext);
}
