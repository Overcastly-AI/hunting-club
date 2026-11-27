/**
 * The hunter's name reaching their clubs. Renaming works offline: the latest name is queued
 * in the phone's database (one row, each edit replaces it) and sent with the club sync, to
 * every club listed for the signed-in account (clubsForAccount), once signed in and online.
 * A free user with no account never gets here (the club sync needs a session). The name is
 * never logged.
 */
import {
  clubsForAccount,
  isNoClubAccess,
  type ClubApiClient,
  type MemberJoin,
} from '@huntclub/shared';

import type { SqlDatabase } from '../db/types';
import { loadClubs } from './store';

export type QueuedName = MemberJoin & { queuedAt: number };

/** Queues `profile` for the clubs, replacing any name still waiting. Local only. */
export async function queueNameSync(
  db: SqlDatabase,
  profile: MemberJoin,
  now: number,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO pending_name_sync (id, display_name, initials, queued_at) VALUES (1, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       display_name = excluded.display_name, initials = excluded.initials, queued_at = excluded.queued_at`,
    profile.displayName,
    profile.initials,
    now,
  );
}

export async function loadQueuedName(db: SqlDatabase): Promise<QueuedName | null> {
  const row = await db.getFirstAsync<{
    display_name: string;
    initials: string;
    queued_at: number;
  }>('SELECT display_name, initials, queued_at FROM pending_name_sync WHERE id = 1');
  return row
    ? { displayName: row.display_name, initials: row.initials, queuedAt: row.queued_at }
    : null;
}

/**
 * Sends the queued name to each club listed for `userId`. A club that refuses the account (403:
 * not theirs, or no longer) is skipped. The queue is cleared only when every other club has the
 * name and no invite is still waiting to be redeemed; otherwise it stays for the next sync (a
 * newer edit made meanwhile always stays). Returns how many clubs failed.
 */
export async function sendQueuedName(
  db: SqlDatabase,
  api: ClubApiClient,
  userId: string,
): Promise<{ failed: number }> {
  const queued = await loadQueuedName(db);
  if (!queued) return { failed: 0 };
  const clubs = clubsForAccount(await loadClubs(db), userId);
  let failed = 0;
  // An unredeemed invite has no roster entry to rename yet: keep the name for after it joins.
  let waiting = false;
  for (const club of clubs) {
    if (club.pendingInvite) {
      waiting = true;
      continue;
    }
    try {
      await api.updateMemberProfile(club.id, userId, {
        displayName: queued.displayName,
        initials: queued.initials,
      });
    } catch (error) {
      if (!isNoClubAccess(error)) failed += 1;
    }
  }
  if (failed === 0 && !waiting) {
    await db.runAsync(
      'DELETE FROM pending_name_sync WHERE id = 1 AND queued_at = ?',
      queued.queuedAt,
    );
  }
  return { failed };
}
