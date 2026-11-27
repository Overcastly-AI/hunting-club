// A renamed hunter's name reaching their clubs: queued on the phone, sent with the club sync.
import { ClubApiRequestError } from '@huntclub/shared';

import { migrate } from '../../db/migrate';
import { migrations } from '../../db/migrations';
import { saveProfile } from '../../db/appState';
import {
  CLUB_ID,
  USER_ID,
  clubJoinUrl,
  fakeClubApi,
  memorySecureStorage,
} from '../../test-utils/fakeClubApi';
import { createTestDatabase } from '../../test-utils/nodeSqlite';
import { loadQueuedName, queueNameSync, sendQueuedName } from '../nameSync';
import { joinClubFromLink, syncClub } from '../sync';

const NOW = Date.parse('2026-11-27T12:00:00Z');
const JAKE = { displayName: 'Jake Smith', initials: 'JS' };

/** A phone whose hunter joined CLUB_ID and synced it as USER_ID. */
async function memberPhone() {
  const db = createTestDatabase();
  await migrate(db, migrations);
  await saveProfile(db, { displayName: 'Max', initials: 'MX' });
  await joinClubFromLink(
    db,
    memorySecureStorage(),
    clubJoinUrl(),
    { displayName: 'Max', initials: 'MX' },
    NOW,
  );
  await syncClub(db, fakeClubApi(), CLUB_ID, NOW);
  return db;
}

it('sends the queued name to the club and clears the queue', async () => {
  const db = await memberPhone();
  await queueNameSync(db, JAKE, NOW);
  const api = fakeClubApi();
  expect(await sendQueuedName(db, api, USER_ID)).toEqual({ failed: 0 });
  expect(api.updateMemberProfile).toHaveBeenCalledWith(CLUB_ID, USER_ID, JAKE);
  expect(await loadQueuedName(db)).toBeNull();
});

it('keeps the name queued while offline, then sends it when signal returns', async () => {
  const db = await memberPhone();
  await queueNameSync(db, JAKE, NOW);
  expect(await sendQueuedName(db, fakeClubApi({ offline: true }), USER_ID)).toEqual({ failed: 1 });
  expect(await loadQueuedName(db)).toMatchObject(JAKE);

  const online = fakeClubApi();
  expect(await sendQueuedName(db, online, USER_ID)).toEqual({ failed: 0 });
  expect(online.updateMemberProfile).toHaveBeenCalledWith(CLUB_ID, USER_ID, JAKE);
  expect(await loadQueuedName(db)).toBeNull();
});

it('keeps only the latest of two edits', async () => {
  const db = await memberPhone();
  await queueNameSync(db, { displayName: 'Jake', initials: 'J' }, NOW);
  await queueNameSync(db, JAKE, NOW + 1);
  expect(await db.getFirstAsync('SELECT count(*) AS n FROM pending_name_sync')).toEqual({ n: 1 });
  const api = fakeClubApi();
  await sendQueuedName(db, api, USER_ID);
  expect(api.updateMemberProfile).toHaveBeenCalledTimes(1);
  expect(api.updateMemberProfile).toHaveBeenCalledWith(CLUB_ID, USER_ID, JAKE);
});

it('ignores a 403 from a club that refuses the account, and calls no club another account synced', async () => {
  const db = await memberPhone();
  await queueNameSync(db, JAKE, NOW);
  const refused = fakeClubApi();
  refused.updateMemberProfile.mockRejectedValueOnce(new ClubApiRequestError('forbidden', 403));
  expect(await sendQueuedName(db, refused, USER_ID)).toEqual({ failed: 0 });
  expect(await loadQueuedName(db)).toBeNull();

  // Another account signed in on this phone: CLUB_ID is hidden from it, so it is never asked.
  await queueNameSync(db, JAKE, NOW + 1);
  const other = fakeClubApi();
  await sendQueuedName(db, other, '00000000-0000-4000-8000-0000000000bb');
  expect(other.updateMemberProfile).not.toHaveBeenCalled();
});

it('waits for an invite still to be redeemed before clearing the queue', async () => {
  const db = createTestDatabase();
  await migrate(db, migrations);
  await joinClubFromLink(db, memorySecureStorage(), clubJoinUrl(), JAKE, NOW);
  await queueNameSync(db, JAKE, NOW);
  const api = fakeClubApi();
  expect(await sendQueuedName(db, api, USER_ID)).toEqual({ failed: 0 });
  expect(api.updateMemberProfile).not.toHaveBeenCalled();
  expect(await loadQueuedName(db)).toMatchObject(JAKE);
});
