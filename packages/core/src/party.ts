/**
 * Party rules (docs/SPEC.md "Free vs Club").
 *
 * The 3-person cap on free parties is enforced by the app: the party QR code
 * stops being shown and the app refuses to join a full party. It is a soft
 * limit (a stock Meshtastic client with the key can still listen).
 */

/** Maximum people in a free hunting party, including the person who started it. */
export const FREE_PARTY_MAX_MEMBERS = 3;

export class PartyFullError extends Error {
  constructor(readonly limit: number) {
    super(`This party is full (${limit} people max)`);
    this.name = 'PartyFullError';
  }
}

/**
 * Whether one more person may join. `limit` defaults to the free-party cap;
 * pass `null` for groups without a cap (club parties: open decision 2).
 */
export function canJoinParty(
  memberCount: number,
  limit: number | null = FREE_PARTY_MAX_MEMBERS,
): boolean {
  return limit === null || memberCount < limit;
}

/** Throws PartyFullError when the party is full. */
export function assertCanJoinParty(
  memberCount: number,
  limit: number | null = FREE_PARTY_MAX_MEMBERS,
): void {
  if (!canJoinParty(memberCount, limit)) throw new PartyFullError(limit!);
}

/** The party QR code is shown only while someone else can still join. */
export const shouldShowPartyQr = canJoinParty;
