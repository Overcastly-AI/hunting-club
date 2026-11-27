// Renaming in the app: the club provider sends the name at once when signed in, and never
// calls the backend for someone who isn't.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { saveProfile } from '../../db/appState';
import { useProfile } from '../../profile/ProfileProvider';
import { clubWrapper } from '../../test-utils/clubFixture';
import {
  CLUB_ID,
  USER_ID,
  clubJoinUrl,
  fakeClubApi,
  fakeSession,
  memorySecureStorage,
} from '../../test-utils/fakeClubApi';
import { loadQueuedName } from '../nameSync';
import { joinClubFromLink, syncClub } from '../sync';

jest.mock('expo-sqlite', () => ({ useSQLiteContext: jest.fn() }));

const NOW = Date.parse('2026-11-27T12:00:00Z');
const MAX = { displayName: 'Max', initials: 'MX' };
const JAKE = { displayName: 'Jake Smith', initials: 'JS' };

/** Shows the saved name; pressing it renames the hunter to Jake Smith. */
function Probe() {
  const { profile, save } = useProfile();
  return <Text onPress={() => void save(JAKE)}>{profile?.displayName ?? 'loading'}</Text>;
}

async function renameOn(signedIn: boolean) {
  const api = fakeClubApi();
  const { db, wrap } = await clubWrapper(
    { session: fakeSession(signedIn), api, secrets: memorySecureStorage() },
    () => NOW,
  );
  await saveProfile(db, MAX);
  await joinClubFromLink(db, memorySecureStorage(), clubJoinUrl(), MAX, NOW);
  await syncClub(db, fakeClubApi(), CLUB_ID, NOW);
  await render(wrap(<Probe />));
  await fireEvent.press(await screen.findByText('Max'));
  expect(await screen.findByText('Jake Smith')).toBeTruthy();
  return { api, db };
}

it('sends a signed-in member’s new name to their club', async () => {
  const { api, db } = await renameOn(true);
  await waitFor(() => expect(api.updateMemberProfile).toHaveBeenCalledWith(CLUB_ID, USER_ID, JAKE));
  await waitFor(async () => expect(await loadQueuedName(db)).toBeNull());
});

it('sends nothing when no one is signed in (the name stays queued on the phone)', async () => {
  const { api, db } = await renameOn(false);
  await act(async () => undefined);
  expect(api.updateMemberProfile).not.toHaveBeenCalled();
  expect(api.listMyClubs).not.toHaveBeenCalled();
  expect(await loadQueuedName(db)).toMatchObject(JAKE);
});
