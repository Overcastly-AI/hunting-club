// Club mode on the Party/Club tab and the join screen, on an in-memory database and a
// fake club API (no network, no native modules).
import { Fragment } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { saveProfile } from '../../db/appState';
import { clubWrapper } from '../../test-utils/clubFixture';
import {
  CLUB_ID,
  clubJoinUrl,
  fakeClubApi,
  fakeSession,
  memorySecureStorage,
  partyJoinUrl,
  USER_ID,
} from '../../test-utils/fakeClubApi';
import { ClubSection } from '../ClubSection';
import type { ClubServices } from '../ClubProvider';
import { JoinClubScreen } from '../JoinClubScreen';
import { clubCopy } from '../copy';
import { loadClubs } from '../store';
import { joinClubFromLink, syncClub } from '../sync';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('expo-sqlite', () => ({ useSQLiteContext: jest.fn() }));

const NOW = Date.parse('2026-11-26T12:00:00Z');

const setup = (services: ClubServices) => clubWrapper(services, () => NOW);

it('shows how to join when the phone has no club (free user: no API calls)', async () => {
  const api = fakeClubApi();
  const { wrap } = await setup({
    session: fakeSession(false),
    api,
    secrets: memorySecureStorage(),
  });
  await render(wrap(<ClubSection now={() => NOW} />));
  expect(await screen.findByText(clubCopy.section.none)).toBeTruthy();
  expect(screen.getByText(clubCopy.section.signIn)).toBeTruthy();
  expect(api.listMyClubs).not.toHaveBeenCalled();
});

it('shows a club joined offline as pending until sign-in', async () => {
  const { db, wrap } = await setup({
    session: fakeSession(false),
    api: fakeClubApi(),
    secrets: memorySecureStorage(),
  });
  await joinClubFromLink(
    db,
    memorySecureStorage(),
    clubJoinUrl(),
    { displayName: 'Max', initials: 'MX' },
    NOW,
  );
  await render(wrap(<ClubSection now={() => NOW} />));
  expect(await screen.findByText(clubCopy.section.pending)).toBeTruthy();
});

it('when signed in, syncs on open and shows club mode with features on', async () => {
  const api = fakeClubApi({ featuresUntil: '2027-09-01T00:00:00.000Z' });
  const { db, wrap } = await setup({
    session: fakeSession(true),
    api,
    secrets: memorySecureStorage(),
  });
  await joinClubFromLink(
    db,
    memorySecureStorage(),
    clubJoinUrl(),
    { displayName: 'Max', initials: 'MX' },
    NOW,
  );
  await render(wrap(<ClubSection now={() => NOW} />));
  expect(await screen.findByText('Oak Ridge')).toBeTruthy();
  expect(screen.getByText(clubCopy.section.role.member)).toBeTruthy();
  expect(screen.getByText(clubCopy.section.featuresOpen)).toBeTruthy();
  expect(api.redeemInvite).toHaveBeenCalledTimes(1);
});

it("hides another account's club after a user switch, keeps it saved, and shows it again for its own account", async () => {
  const session = fakeSession(true, '00000000-0000-4000-8000-0000000000bb');
  const { db, wrap } = await setup({ session, api: fakeClubApi(), secrets: memorySecureStorage() });
  // The first account (USER_ID) joined and synced Oak Ridge on this phone.
  await joinClubFromLink(
    db,
    memorySecureStorage(),
    clubJoinUrl(),
    { displayName: 'Max', initials: 'MX' },
    NOW,
  );
  await syncClub(db, fakeClubApi(), CLUB_ID, NOW);

  const view = await render(wrap(<ClubSection now={() => NOW} />));
  expect(await screen.findByText(clubCopy.section.none)).toBeTruthy();
  expect(screen.queryByText('Oak Ridge')).toBeNull();
  expect((await loadClubs(db)).map((c) => c.name)).toEqual(['Oak Ridge']); // kept, only hidden

  session.user = async () => ({ userId: USER_ID }); // its own account signs back in
  // A fresh provider (keyed), as after signing in: it reads the clubs again.
  await view.rerender(<Fragment key="again">{wrap(<ClubSection now={() => NOW} />)}</Fragment>);
  expect(await screen.findByText('Oak Ridge')).toBeTruthy();
});

it('joins from a Club QR code with a name and initials', async () => {
  const api = fakeClubApi();
  const { db, wrap } = await setup({
    session: fakeSession(false),
    api,
    secrets: memorySecureStorage(),
  });
  await render(wrap(<JoinClubScreen url={clubJoinUrl()} onDone={jest.fn()} />));
  await fireEvent.changeText(screen.getByLabelText(clubCopy.join.name), 'Max');
  await fireEvent.changeText(screen.getByLabelText(clubCopy.join.initials), 'mx');
  await fireEvent.press(screen.getByRole('button', { name: clubCopy.join.join }));
  expect(await screen.findByText(clubCopy.join.joined)).toBeTruthy();
  expect(screen.getByText(clubCopy.join.signInToFinish)).toBeTruthy();
  const row = await db.getFirstAsync<{ pending_initials: string }>(
    'SELECT pending_initials FROM groups',
  );
  expect(row?.pending_initials).toBe('MX');
  expect(api.redeemInvite).not.toHaveBeenCalled();
});

it('prefills the join form with the name from onboarding', async () => {
  const { db, wrap } = await setup({
    session: fakeSession(false),
    api: fakeClubApi(),
    secrets: memorySecureStorage(),
  });
  await saveProfile(db, { displayName: 'Maxine', initials: 'MX' });
  await render(wrap(<JoinClubScreen url={clubJoinUrl()} onDone={jest.fn()} />));
  expect(await screen.findByDisplayValue('Maxine')).toBeTruthy();
  expect(screen.getByDisplayValue('MX')).toBeTruthy();
});

it('sends party QR codes and other links elsewhere', async () => {
  const { wrap } = await setup({
    session: fakeSession(false),
    api: fakeClubApi(),
    secrets: memorySecureStorage(),
  });
  const { rerender } = await render(
    wrap(<JoinClubScreen url={partyJoinUrl()} onDone={jest.fn()} />),
  );
  expect(await screen.findByText(clubCopy.join.notClub)).toBeTruthy();
  await rerender(wrap(<JoinClubScreen url="https://example.com" onDone={jest.fn()} />));
  await waitFor(() => expect(screen.getByText(clubCopy.join.badLink)).toBeTruthy());
});
