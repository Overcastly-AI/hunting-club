/**
 * Joining a club and keeping its local copy fresh.
 *
 * Joining works offline: scanning a Club QR code saves the club and its radio key
 * right away (the mesh works at once). The invite is redeemed later, the first time the
 * phone is online and signed in; then the club's name, stands, areas and entitlement
 * are downloaded and kept for offline use.
 */
import { decodeJoinUrl } from '@huntclub/mesh';
import type { ClubApiClient, MemberJoin } from '@huntclub/shared';

import type { SqlDatabase } from '../db/types';
import { type MapPackSync, syncClubMapPacks } from './mapPacks';
import { SECURE_KEYS, type SecureStorage } from '../storage/secure';
import { loadClubs, loadPendingInvite, saveClubSnapshot, saveJoinedClub } from './store';

export class NotAClubLinkError extends Error {
  constructor() {
    super('This QR code is for a hunting party, not a club.');
    this.name = 'NotAClubLinkError';
  }
}

/** Saves the club from a Club QR code / invite link. Returns the club id. */
export async function joinClubFromLink(
  db: SqlDatabase,
  secrets: Pick<SecureStorage, 'set'>,
  url: string,
  profile: MemberJoin,
  now: number,
): Promise<string> {
  const link = decodeJoinUrl(url);
  if (link.target.kind !== 'club') throw new NotAClubLinkError();
  // The link holds the club channel key: keystore only, never SQLite or logs.
  await secrets.set(SECURE_KEYS.clubJoinLink, url);
  await saveJoinedClub(db, {
    clubId: link.target.clubId,
    inviteToken: link.target.inviteToken,
    displayName: profile.displayName,
    initials: profile.initials,
    now,
  });
  return link.target.clubId;
}

/**
 * Redeems a pending invite (if any), then downloads the club. Needs a signed-in
 * session and internet; throws the API's error otherwise (local data is untouched).
 */
export async function syncClub(
  db: SqlDatabase,
  api: ClubApiClient,
  clubId: string,
  now: number,
  mapPacks?: MapPackSync,
): Promise<void> {
  const pending = await loadPendingInvite(db, clubId);
  const redeemed = pending
    ? await api.redeemInvite({
        token: pending.token,
        displayName: pending.displayName,
        initials: pending.initials,
      })
    : undefined;
  const [mine, stands, areas, entitlement] = await Promise.all([
    api.listMyClubs(),
    api.listStands(clubId),
    api.listAreas(clubId),
    api.getEntitlement(clubId),
  ]);
  const found = mine.find((m) => m.club.id === clubId);
  if (!found) throw new Error('not a member of this club');
  await saveClubSnapshot(
    db,
    { club: found.club, membership: redeemed ?? found.membership, stands, areas, entitlement },
    now,
  );
  // The club's map packs are a bonus: a failed download never fails the club sync.
  if (mapPacks) {
    await syncClubMapPacks(db, api, mapPacks.files, mapPacks.env, clubId, now).catch(
      () => undefined,
    );
  }
}

/** Syncs every club on this phone; one club failing doesn't stop the others. */
export async function syncAllClubs(
  db: SqlDatabase,
  api: ClubApiClient,
  now: number,
  mapPacks?: MapPackSync,
): Promise<{ failed: { clubId: string; error: unknown }[] }> {
  const failed: { clubId: string; error: unknown }[] = [];
  for (const club of await loadClubs(db)) {
    await syncClub(db, api, club.id, now, mapPacks).catch((error: unknown) =>
      failed.push({ clubId: club.id, error }),
    );
  }
  return { failed };
}
