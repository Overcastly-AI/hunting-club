// Joining from a Club QR code (offline), then redeeming and syncing against a fake API.
import { createTestDatabase } from '../../test-utils/nodeSqlite';
import {
  CLUB_ID,
  INVITE_TOKEN,
  clubJoinUrl,
  fakeClubApi,
  mapPack,
  memorySecureStorage,
  partyJoinUrl,
} from '../../test-utils/fakeClubApi';
import { SECURE_KEYS } from '../../storage/secure';
import { decodeJoinUrl } from '@huntclub/mesh';
import { hasClubFeatures } from '@huntclub/shared';
import { entitlementOf } from '../entitlement';
import {
  loadClubAreas,
  loadClubStands,
  loadClubs,
  loadPendingInvite,
  loadClubRadio,
  UNSYNCED_CLUB_NAME,
} from '../store';
import { NotAClubLinkError, joinClubFromLink, syncAllClubs, syncClub } from '../sync';
import { migrate } from '../../db/migrate';
import { migrations } from '../../db/migrations';

const NOW = Date.parse('2026-11-26T12:00:00Z');
const profile = { displayName: 'Max', initials: 'MX' };
let secrets = memorySecureStorage();
beforeEach(() => {
  secrets = memorySecureStorage();
});

async function db() {
  const d = createTestDatabase();
  await migrate(d, migrations);
  return d;
}

it('joins offline from the link: club, radio key and invite saved, nothing sent', async () => {
  const d = await db();
  expect(await joinClubFromLink(d, secrets, clubJoinUrl(), profile, NOW)).toBe(CLUB_ID);
  expect(await loadClubs(d)).toEqual([
    {
      id: CLUB_ID,
      name: UNSYNCED_CLUB_NAME,
      role: null,
      memberUserId: null,
      featuresUntil: null,
      pendingInvite: true,
      syncedAt: null,
      graceMinutes: 30,
    },
  ]);
  expect(await loadPendingInvite(d, CLUB_ID)).toEqual({ token: INVITE_TOKEN, ...profile });
  // The link (with the channel key) goes to the keystore, never to SQLite.
  expect(secrets.items.get(SECURE_KEYS.clubJoinLink)).toBe(clubJoinUrl());
  const row = await d.getFirstAsync<{ channel_key: Uint8Array | null }>(
    'SELECT channel_key FROM groups',
  );
  expect(row?.channel_key).toBeNull();
});

it('refuses a party link', async () => {
  await expect(
    joinClubFromLink(await db(), secrets, partyJoinUrl(), profile, NOW),
  ).rejects.toBeInstanceOf(NotAClubLinkError);
});

it('redeems the invite once online, then stores club, stands with mesh ids and entitlement', async () => {
  const d = await db();
  await joinClubFromLink(d, secrets, clubJoinUrl(), profile, NOW);
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
  expect(hasClubFeatures(entitlementOf(club!), NOW)).toBe(true);
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
  await joinClubFromLink(d, secrets, clubJoinUrl(), profile, NOW);
  const { failed } = await syncAllClubs(d, fakeClubApi({ offline: true }), NOW);
  expect(failed).toHaveLength(1);
  expect((await loadClubs(d))[0]).toMatchObject({ pendingInvite: true, name: UNSYNCED_CLUB_NAME });
});

it('never asks for a club another account synced on this phone, and keeps it for the radio', async () => {
  const d = await db();
  await joinClubFromLink(d, secrets, clubJoinUrl(), profile, NOW);
  await syncClub(d, fakeClubApi(), CLUB_ID, NOW); // the first account redeems and syncs
  // Signed out, then another account signs in: it belongs to no club.
  const other = fakeClubApi();
  const { failed } = await syncAllClubs(d, other, NOW + 1);
  expect(failed).toEqual([]);
  expect(other.listMyClubs).toHaveBeenCalledTimes(1);
  for (const call of [
    other.listStands,
    other.listAreas,
    other.getEntitlement,
    other.redeemInvite,
  ]) {
    expect(call).not.toHaveBeenCalled();
  }
  expect((await loadClubs(d))[0]).toMatchObject({ id: CLUB_ID, name: 'Oak Ridge', syncedAt: NOW });
});

it('closes club features when the club has no paid-through date', async () => {
  const d = await db();
  await joinClubFromLink(d, secrets, clubJoinUrl(), profile, NOW);
  await syncClub(d, fakeClubApi(), CLUB_ID, NOW);
  const [club] = await loadClubs(d);
  expect(entitlementOf(club!)).toBeNull();
});

it('gives the radio the club: stands, areas, grace time and the club channels from the link', async () => {
  const d = await db();
  await joinClubFromLink(d, secrets, clubJoinUrl(), profile, NOW);
  await syncClub(d, fakeClubApi(), CLUB_ID, NOW);
  const { club: radio, hiddenClubChannels } = await loadClubRadio(d, secrets, await loadClubs(d));
  expect(hiddenClubChannels).toEqual([]);
  expect(radio).toMatchObject({ clubId: CLUB_ID, graceMinutes: 30, areas: [] });
  expect(radio!.stands.map((s) => s.meshId)).toEqual([1, 2]);
  expect(radio!.channelSet).toEqual(decodeJoinUrl(clubJoinUrl()).channelSet);
});

it('leaves the channels out when the saved link is for another club', async () => {
  const d = await db();
  await joinClubFromLink(d, secrets, clubJoinUrl(), profile, NOW);
  await secrets.set(SECURE_KEYS.clubJoinLink, clubJoinUrl('00000000-0000-4000-8000-0000000000ff'));
  expect((await loadClubRadio(d, secrets, await loadClubs(d))).club!.channelSet).toBeUndefined();
});

it("returns a hidden club's channels only as channels never to use, and no club", async () => {
  const d = await db();
  await joinClubFromLink(d, secrets, clubJoinUrl(), profile, NOW);
  // The saved club is hidden from the signed-in account (clubsForAccount listed none).
  expect(await loadClubRadio(d, secrets, [])).toEqual({
    club: null,
    hiddenClubChannels: [decodeJoinUrl(clubJoinUrl()).channelSet],
  });
});

it('has no club and nothing hidden on a phone without a club', async () => {
  expect(await loadClubRadio(await db(), secrets, [])).toEqual({
    club: null,
    hiddenClubChannels: [],
  });
});

it('fetches the club map packs with the club, and a failed download never fails the sync', async () => {
  const d = await db();
  await joinClubFromLink(d, secrets, clubJoinUrl(), profile, NOW);
  const api = fakeClubApi({ mapPacks: () => [mapPack('p1')] });
  const files = {
    download: jest.fn(async () => {
      throw new Error('network');
    }),
    remove: jest.fn(),
  };
  await syncClub(d, api, CLUB_ID, NOW, { files, env: 'dev' });
  expect(files.download).toHaveBeenCalledTimes(1);
  expect((await loadClubs(d))[0]?.syncedAt).toBe(NOW);
});
