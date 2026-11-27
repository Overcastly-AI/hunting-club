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

/** The club API refused this club to the signed-in account (403): not theirs, or no longer. */
export const isNoClubAccess = (error: unknown): boolean =>
  error instanceof ClubApiRequestError && error.status === 403;
