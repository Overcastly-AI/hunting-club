/**
 * Which club a signed-in client works with, and when the club API refuses it. Shared by
 * the web admin (its selected club) and the app (which of the phone's clubs it syncs), so
 * a club id from one account is never sent with another account's token.
 */
import type { MyClub } from './api';
import { ClubApiRequestError } from './apiClient';

/** A club picked by one account, keyed to that account (Cognito sub). */
export interface ClubChoice {
  userId: string | undefined;
  clubId: string;
}

/** True when `clubId` is one of the clubs GET /me/clubs listed for this account. */
export const isMyClub = (mine: readonly MyClub[], clubId: string): boolean =>
  mine.some((m) => m.club.id === clubId);

/**
 * The club this account works with: the stored choice if it is this account's and still
 * one of its clubs (that pass `eligible`), otherwise the account's first eligible club,
 * otherwise null. Another account's choice, or a club the account left, is dropped.
 */
export function chooseClub(
  mine: readonly MyClub[],
  userId: string | undefined,
  stored: ClubChoice | null,
  eligible: (club: MyClub) => boolean = () => true,
): ClubChoice | null {
  const allowed = mine.filter(eligible);
  if (stored && stored.userId === userId && isMyClub(allowed, stored.clubId)) return stored;
  const first = allowed[0];
  return first ? { userId, clubId: first.club.id } : null;
}

/** Which account a club saved on a device belongs to (from its last sync). */
export interface SavedClubOwner {
  /** The account whose membership the device last synced; null before the first sync. */
  memberUserId: string | null;
  /** Joined from an invite on this device, not redeemed yet (belongs to whoever signs in). */
  pendingInvite: boolean;
}

/**
 * The saved clubs to list for the signed-in account (`userId`, undefined when signed out):
 * its own and invites still waiting, all of them when signed out. Offline, from the saved
 * membership (sync keeps it to isMyClub). Others stay saved, only hidden, and show again
 * when their own account signs back in.
 */
export function clubsForAccount<T extends SavedClubOwner>(
  clubs: readonly T[],
  userId: string | undefined,
): T[] {
  if (userId === undefined) return [...clubs];
  return clubs.filter(
    (club) => club.pendingInvite || club.memberUserId === null || club.memberUserId === userId,
  );
}

/**
 * The club API refused this club to the signed-in account (403): not theirs, or no longer.
 * `club_inactive` is also a 403, but it is about the club's plan (a paid feature without a
 * subscription), not about access: the club stays chosen and the page says what the plan opens.
 */
export const isNoClubAccess = (error: unknown): boolean =>
  error instanceof ClubApiRequestError && error.status === 403 && error.code !== 'club_inactive';
