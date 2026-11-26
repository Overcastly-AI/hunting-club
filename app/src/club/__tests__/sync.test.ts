// Joining from a Club QR code (offline), then redeeming and syncing against a fake API.
import { createTestDatabase } from '../../test-utils/nodeSqlite';
import {
  CLUB_ID,
  INVITE_TOKEN,
  clubJoinUrl,
  fakeClubApi,
  partyJoinUrl,
} from '../../test-utils/fakeClubApi';
import { clubFeaturesOpen, entitlementOf } from '../entitlement';
import {
  loadClubAreas,
  loadClubStands,
  loadClubs,
  loadPendingInvite,
  UNSYNCED_CLUB_NAME,
} from '../store';
import { NotAClubLinkError, joinClubFromLink, syncAllClubs, syncClub } from '../sync';
import { migrate } from '../../db/migrate';
import { migrations } from '../../db/migrations';

const NOW = Date.parse('2026-11-26T12:00:00Z');
const profile = { displayName: 'Max', initials: 'MX' };

async function db() {
  const d = createTestDatabase();
  await migrate(d, migrations);
  return d;
}

it('joins offline from the link: club, radio key and invite saved, nothing sent', async () => {
  const d = await db();
  expect(await joinClubFromLink(d, clubJoinUrl(), profile, NOW)).toBe(CLUB_ID);
  expect(await loadClubs(d)).toEqual([
    {
      id: CLUB_ID,
      name: UNSYNCED_CLUB_NAME,
      role: null,
      featuresUntil: null,
      pendingInvite: true,
      syncedAt: null,
    },
  ]);
  expect(await loadPendingInvite(d, CLUB_ID)).toEqual({ token: INVITE_TOKEN, ...profile });
  const row = await d.getFirstAsync<{ channel_key: Uint8Array }>('SELECT channel_key FROM groups');
  expect(row?.channel_key).toHaveLength(32);
});

it('refuses a party link', async () => {
  await expect(joinClubFromLink(await db(), partyJoinUrl(), profile, NOW)).rejects.toBeInstanceOf(
    NotAClubLinkError,
  );
});

it('redeems the invite once online, then stores club, stands with mesh ids and entitlement', async () => {
  const d = await db();
  await joinClubFromLink(d, clubJoinUrl(), profile, NOW);
  const api = fakeClubApi({ featuresUntil: '2027-09-01T00:00:00.000Z' });
  await syncClub(d, api, CLUB_ID, NOW);

  expect(api.redeemInvite).toHaveBeenCalledWith({ token: INVITE_TOKEN, ...profile });
  const [club] = await loadClubs(d);
  expect(club).toMatchObject({
    name: 'Oak Ridge',
    role: 'member',
    pendingInvite: false,
    syncedAt: NOW,
  });
  expect(clubFeaturesOpen(entitlementOf(club!), NOW)).toBe(true);
  expect((await loadClubStands(d, CLUB_ID)).map((s) => [s.meshId, s.name])).toEqual([
    [1, 'Creek Stand'],
    [2, 'Ridge Ladder'],
  ]);
  expect(await loadClubAreas(d, CLUB_ID)).toEqual([]);

  // The next sync doesn't redeem again.
  await syncClub(d, api, CLUB_ID, NOW + 1);
  expect(api.redeemInvite).toHaveBeenCalledTimes(1);
});

it('keeps the offline join when the network is down, and reports the failure', async () => {
  const d = await db();
  await joinClubFromLink(d, clubJoinUrl(), profile, NOW);
  const { failed } = await syncAllClubs(d, fakeClubApi({ offline: true }), NOW);
  expect(failed).toHaveLength(1);
  expect((await loadClubs(d))[0]).toMatchObject({ pendingInvite: true, name: UNSYNCED_CLUB_NAME });
});

it('closes club features when the club has no paid-through date', async () => {
  const d = await db();
  await joinClubFromLink(d, clubJoinUrl(), profile, NOW);
  await syncClub(d, fakeClubApi(), CLUB_ID, NOW);
  const [club] = await loadClubs(d);
  expect(entitlementOf(club!)).toBeNull();
});
