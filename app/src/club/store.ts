/**
 * The phone's copy of its clubs (SQLite), so club features work offline:
 * the club row in `groups` (with this phone's membership, cached entitlement and any
 * invite still to redeem), and the club's stands and areas with their mesh ids.
 */
import type { Area, Club, Entitlement, Member, MemberRole, Stand } from '@huntclub/shared';

import type { ClubArea, ClubStand } from '../checkin/placement';
import type { SqlDatabase } from '../db/types';

/** A club as the Party/Club tab shows it. */
export type LocalClub = {
  id: string;
  name: string;
  role: MemberRole | null;
  /** Club features are open until this moment (ms); null = closed or unknown. */
  featuresUntil: number | null;
  /** Joined on the mesh from a link, not yet added to the roster (needs sign-in + internet). */
  pendingInvite: boolean;
  syncedAt: number | null;
};

/** What a sync downloads for one club. */
export type ClubSnapshot = {
  club: Club;
  membership: Member;
  stands: readonly Stand[];
  areas: readonly Area[];
  entitlement: Entitlement;
};

/** Until name and roster arrive from the cloud, a club joined offline shows this name. */
export const UNSYNCED_CLUB_NAME = 'Club';

const ms = (iso: string | undefined) => (iso ? Date.parse(iso) : null);
const flag = (b: boolean) => (b ? 1 : 0);

/** Saves a club joined from a Club QR code (works offline). Keeps any synced data. */
export async function saveJoinedClub(
  db: SqlDatabase,
  join: {
    clubId: string;
    channelKey: Uint8Array | null;
    inviteToken: string;
    displayName: string;
    initials: string;
    now: number;
  },
): Promise<void> {
  await db.runAsync(
    `INSERT INTO groups (id, kind, name, channel_key, pending_invite, pending_display_name,
                         pending_initials, updated_at)
     VALUES (?, 'club', ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       channel_key = COALESCE(excluded.channel_key, channel_key),
       pending_invite = CASE WHEN my_user_id IS NULL THEN excluded.pending_invite END,
       pending_display_name = excluded.pending_display_name,
       pending_initials = excluded.pending_initials,
       updated_at = excluded.updated_at`,
    join.clubId,
    UNSYNCED_CLUB_NAME,
    join.channelKey,
    join.inviteToken,
    join.displayName,
    join.initials,
    join.now,
  );
}

/** An invite still waiting to be redeemed, with the profile to join as. */
export async function loadPendingInvite(
  db: SqlDatabase,
  clubId: string,
): Promise<{ token: string; displayName: string; initials: string } | null> {
  const row = await db.getFirstAsync<{
    pending_invite: string | null;
    pending_display_name: string | null;
    pending_initials: string | null;
  }>(
    'SELECT pending_invite, pending_display_name, pending_initials FROM groups WHERE id = ?',
    clubId,
  );
  if (!row?.pending_invite || !row.pending_display_name || !row.pending_initials) return null;
  return {
    token: row.pending_invite,
    displayName: row.pending_display_name,
    initials: row.pending_initials,
  };
}

/** Replaces the club's synced data (one transaction; the invite is cleared). */
export async function saveClubSnapshot(
  db: SqlDatabase,
  snap: ClubSnapshot,
  now: number,
): Promise<void> {
  const { club, membership, entitlement } = snap;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO groups (id, kind, name, region, overdue_grace_minutes, my_user_id, my_role,
                           subscription_status, features_until, synced_at, updated_at)
       VALUES (?, 'club', ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         name = excluded.name, region = excluded.region,
         overdue_grace_minutes = excluded.overdue_grace_minutes,
         my_user_id = excluded.my_user_id, my_role = excluded.my_role,
         subscription_status = excluded.subscription_status,
         features_until = excluded.features_until, synced_at = excluded.synced_at,
         pending_invite = NULL, pending_display_name = NULL, pending_initials = NULL,
         updated_at = excluded.updated_at`,
      club.id,
      club.name,
      club.region,
      club.overdueGraceMinutes,
      membership.userId,
      membership.role,
      entitlement.status ?? null,
      ms(entitlement.featuresUntil),
      now,
      ms(club.updatedAt) ?? now,
    );
    // Areas before stands (stands reference areas).
    await db.runAsync('DELETE FROM stands WHERE club_id = ?', club.id);
    await db.runAsync('DELETE FROM areas WHERE club_id = ?', club.id);
    for (const a of snap.areas) {
      await db.runAsync(
        `INSERT INTO areas (id, club_id, mesh_id, name, boundary, notes, active, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        a.id,
        club.id,
        a.meshId,
        a.name,
        JSON.stringify(a.boundary),
        a.notes ?? null,
        flag(a.active),
        Date.parse(a.updatedAt),
      );
    }
    for (const s of snap.stands) {
      await db.runAsync(
        `INSERT INTO stands (id, club_id, mesh_id, area_id, name, type, lat, lon, notes, active,
                             updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        s.id,
        club.id,
        s.meshId,
        s.areaId ?? null,
        s.name,
        s.type,
        s.lat,
        s.lon,
        s.notes ?? null,
        flag(s.active),
        Date.parse(s.updatedAt),
      );
    }
  });
}

type ClubRow = {
  id: string;
  name: string;
  my_role: MemberRole | null;
  features_until: number | null;
  pending_invite: string | null;
  synced_at: number | null;
};

export async function loadClubs(db: SqlDatabase): Promise<LocalClub[]> {
  const rows = await db.getAllAsync<ClubRow>(
    `SELECT id, name, my_role, features_until, pending_invite, synced_at
     FROM groups WHERE kind = 'club' ORDER BY name`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.my_role,
    featuresUntil: r.features_until,
    pendingInvite: r.pending_invite !== null,
    syncedAt: r.synced_at,
  }));
}

/** Active stands with mesh ids, in the shape check-in and the board use. */
export async function loadClubStands(db: SqlDatabase, clubId: string): Promise<ClubStand[]> {
  const rows = await db.getAllAsync<{ mesh_id: number; name: string; lat: number; lon: number }>(
    `SELECT mesh_id, name, lat, lon FROM stands
     WHERE club_id = ? AND active = 1 AND mesh_id IS NOT NULL ORDER BY name`,
    clubId,
  );
  return rows.map((r) => ({
    meshId: r.mesh_id,
    name: r.name,
    position: { lat: r.lat, lon: r.lon },
  }));
}

export async function loadClubAreas(db: SqlDatabase, clubId: string): Promise<ClubArea[]> {
  return db.getAllAsync<ClubArea>(
    `SELECT mesh_id AS meshId, name FROM areas
     WHERE club_id = ? AND active = 1 AND mesh_id IS NOT NULL ORDER BY name`,
    clubId,
  );
}
