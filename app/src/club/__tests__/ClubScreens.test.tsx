// Club mode on the Party/Club tab and the join screen, on an in-memory database and a
// fake club API (no network, no native modules).
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { migrate } from '../../db/migrate';
import { migrations } from '../../db/migrations';
import { createTestDatabase } from '../../test-utils/nodeSqlite';
import { clubJoinUrl, fakeClubApi, fakeSession, partyJoinUrl } from '../../test-utils/fakeClubApi';
import { ClubSection } from '../ClubSection';
import { type ClubServices, ClubStateProvider } from '../ClubProvider';
import { JoinClubScreen } from '../JoinClubScreen';
import { clubCopy } from '../copy';
import { joinClubFromLink } from '../sync';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('expo-sqlite', () => ({ useSQLiteContext: jest.fn() }));

const NOW = Date.parse('2026-11-26T12:00:00Z');

async function setup(services: ClubServices) {
  const db = createTestDatabase();
  await migrate(db, migrations);
  const wrap = (children: ReactNode) => (
    <ClubStateProvider db={db} services={services} now={() => NOW}>
      {children}
    </ClubStateProvider>
  );
  return { db, wrap };
}

it('shows how to join when the phone has no club (free user: no API calls)', async () => {
  const api = fakeClubApi();
  const { wrap } = await setup({ session: fakeSession(false), api });
  await render(wrap(<ClubSection now={() => NOW} />));
  expect(await screen.findByText(clubCopy.section.none)).toBeTruthy();
  expect(screen.getByText(clubCopy.section.signIn)).toBeTruthy();
  expect(api.listMyClubs).not.toHaveBeenCalled();
});

it('shows a club joined offline as pending until sign-in', async () => {
  const { db, wrap } = await setup({ session: fakeSession(false), api: fakeClubApi() });
  await joinClubFromLink(db, clubJoinUrl(), { displayName: 'Max', initials: 'MX' }, NOW);
  await render(wrap(<ClubSection now={() => NOW} />));
  expect(await screen.findByText(clubCopy.section.pending)).toBeTruthy();
});

it('when signed in, syncs on open and shows club mode with features on', async () => {
  const api = fakeClubApi({ featuresUntil: '2027-09-01T00:00:00.000Z' });
  const { db, wrap } = await setup({ session: fakeSession(true), api });
  await joinClubFromLink(db, clubJoinUrl(), { displayName: 'Max', initials: 'MX' }, NOW);
  await render(wrap(<ClubSection now={() => NOW} />));
  expect(await screen.findByText('Oak Ridge')).toBeTruthy();
  expect(screen.getByText(clubCopy.section.role.member)).toBeTruthy();
  expect(screen.getByText(clubCopy.section.featuresOpen)).toBeTruthy();
  expect(api.redeemInvite).toHaveBeenCalledTimes(1);
});

it('joins from a Club QR code with a name and initials', async () => {
  const api = fakeClubApi();
  const { db, wrap } = await setup({ session: fakeSession(false), api });
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

it('sends party QR codes and other links elsewhere', async () => {
  const { wrap } = await setup({ session: fakeSession(false), api: fakeClubApi() });
  const { rerender } = await render(
    wrap(<JoinClubScreen url={partyJoinUrl()} onDone={jest.fn()} />),
  );
  expect(await screen.findByText(clubCopy.join.notClub)).toBeTruthy();
  await rerender(wrap(<JoinClubScreen url="https://example.com" onDone={jest.fn()} />));
  await waitFor(() => expect(screen.getByText(clubCopy.join.badLink)).toBeTruthy());
});
