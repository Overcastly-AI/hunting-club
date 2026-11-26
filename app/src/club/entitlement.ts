import { createContext, useContext } from 'react';

/**
 * A club's signed entitlement, cached on the device so club features work
 * offline (docs/SPEC.md, "Clubs and subscriptions").
 *
 * STUB until Milestone 9: the signed token, its verification and the cache
 * arrive with the club API. Then this type moves to `packages/shared` and the
 * provider fills the context from the verified token.
 */
export type ClubEntitlement = {
  clubId: string;
  clubName: string;
  /** Paid-through date plus grace (ms). Club features freeze after this. */
  expiresAt: number;
};

/** Null for free users and before a club signs in. */
export const ClubEntitlementContext = createContext<ClubEntitlement | null>(null);

export function useClubEntitlement(): ClubEntitlement | null {
  return useContext(ClubEntitlementContext);
}

/**
 * Whether club-only features (the clubhouse board, stand edits, invites) are
 * open. Safety features never call this: they work without payment.
 */
export function clubFeaturesOpen(entitlement: ClubEntitlement | null, now: number): boolean {
  return entitlement !== null && now < entitlement.expiresAt;
}
