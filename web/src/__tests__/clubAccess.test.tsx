// The selected club belongs to the account that chose it (UAT 2026-11-27: after A signed out
// and B signed in on the same browser, every call still went to A's club and failed 403).
import {
  ClubApiRequestError,
  ClubSession,
  memoryTokenStore,
  type AuthTokens,
  type ClubApiClient,
  type SignedInUser,
} from '@huntclub/shared';
import { fakeIdToken } from '@huntclub/shared/testing';
import { fireEvent, render, screen } from '@testing-library/react';
import { adminApi } from '../api/admin';
import { NoClubAccessError } from '../api/types';
import { App } from '../App';
import { NO_ACCESS_TITLE } from '../components/NoClub';
import { LOAD_ERROR } from '../components/useAsync';
import {
  fakeClubClient,
  fakeCognitoAuth,
  SIGNED_IN,
  sampleData,
  type FakeClubData,
} from '../testing/fakeClubApi';
import { go } from '../testing/app';
import { signIn, signOutFromMenu } from '../testing/shell';

const B_USER: SignedInUser = {
  userId: '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3cb0',
  email: 'b@example.com',
};
const B_CLUB = '8b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4db0';

/** Club data for account B: its own club (Cedar Ridge), apart from sampleData()'s (A's). */
function dataForB(): FakeClubData {
  const data = sampleData();
  data.club = { ...data.club!, id: B_CLUB, name: 'Cedar Ridge' };
  data.members = data.members.map((m) => ({ ...m, clubId: B_CLUB }));
  return data;
}

const tokensFor = (user: SignedInUser): AuthTokens => ({
  accessToken: `access-${user.userId}`,
  idToken: fakeIdToken(user),
  refreshToken: `refresh-${user.userId}`,
  expiresAt: Date.now() + 3_600_000,
});

/**
 * The club API as the server sees it: each account gets its own data, and a club id that is
 * not the signed-in account's own answers 403. `requested` records every club id asked for.
 */
function serverFor(session: ClubSession, accounts: Record<string, FakeClubData>) {
  const clients = Object.fromEntries(
    Object.entries(accounts).map(([userId, data]) => [
      userId,
      { data, client: fakeClubClient(data) },
    ]),
  );
  const requested: string[] = [];
  const client = new Proxy({} as ClubApiClient, {
    get:
      (_, method: keyof ClubApiClient) =>
      async (...args: unknown[]) => {
        const own = clients[(await session.user())?.userId ?? '']!;
        if (typeof args[0] === 'string') {
          requested.push(args[0]);
          if (args[0] !== own.data.club?.id) throw new ClubApiRequestError('forbidden', 403);
        }
        return (own.client[method] as (...a: unknown[]) => unknown)(...args);
      },
  });
  return { client, requested };
}

describe('switching accounts on one browser', () => {
  it("signs out A, signs in B: B's club loads and A's club is never asked for", async () => {
    const auth = fakeCognitoAuth();
    const session = new ClubSession(auth, memoryTokenStore(tokensFor(SIGNED_IN)));
    const a = sampleData();
    const { client, requested } = serverFor(session, {
      [SIGNED_IN.userId]: a,
      [B_USER.userId]: dataForB(),
    });
    window.location.hash = '#/stands';
    render(<App session={session} api={adminApi(client, session)} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Stands and areas' })).toBeTruthy();
    expect(requested).toContain(a.club!.id);

    await signOutFromMenu();
    await screen.findByRole('heading', { level: 1, name: 'Sign in' });
    const fromSignOut = requested.length;
    auth.confirmCode = async () => tokensFor(B_USER);
    await signIn();

    expect((await screen.findAllByText('Cedar Ridge')).length).toBeGreaterThan(0);
    go('#/stands');
    expect(await screen.findByRole('heading', { level: 1, name: 'Stands and areas' })).toBeTruthy();
    expect(await screen.findAllByText(/Oak/)).not.toHaveLength(0);
    for (const hash of ['#/roster', '#/billing']) {
      go(hash);
      await screen.findByRole('heading', { level: 1 });
    }
    expect(screen.queryByText(LOAD_ERROR)).toBeNull();
    const afterSignOut = requested.slice(fromSignOut);
    expect(afterSignOut).toContain(B_CLUB);
    expect(afterSignOut).not.toContain(a.club!.id);
  });
});

describe('the selected club', () => {
  it('drops a stale club the account no longer runs and falls back to its own', async () => {
    const session = new ClubSession(fakeCognitoAuth(), memoryTokenStore(tokensFor(SIGNED_IN)));
    const a = sampleData();
    const { client, requested } = serverFor(session, { [SIGNED_IN.userId]: a });
    const api = adminApi(client, session);
    const old = (await api.getClub())!.id;
    // The admin left that club and now runs Cedar Ridge.
    a.club = dataForB().club;
    expect(await api.listStands()).toHaveLength(3);
    expect(requested).toEqual([old, old, B_CLUB]); // the stale id once, then never again
    expect((await api.getClub())?.id).toBe(B_CLUB);
    expect(requested.slice(3)).toEqual([B_CLUB]);
  });

  it('never moves a change (an invite) to another club after a 403', async () => {
    const session = new ClubSession(fakeCognitoAuth(), memoryTokenStore(tokensFor(SIGNED_IN)));
    const a = sampleData();
    const { client, requested } = serverFor(session, { [SIGNED_IN.userId]: a });
    const api = adminApi(client, session);
    const old = (await api.getClub())!.id;
    a.club = dataForB().club;
    await expect(
      api.createInvite({ role: 'member', expiresAt: '2027-01-01T00:00:00.000Z' }),
    ).rejects.toBeInstanceOf(NoClubAccessError);
    expect(requested).toEqual([old, old]);
  });

  it('is looked up once per account, again after forgetUser() or for another account', async () => {
    let who: SignedInUser = SIGNED_IN;
    const client = fakeClubClient();
    const listMyClubs = vi.spyOn(client, 'listMyClubs');
    const api = adminApi(client, { user: async () => who });
    await api.getClub();
    await api.listStands();
    expect(listMyClubs).toHaveBeenCalledTimes(1);
    api.forgetUser();
    await api.getClub();
    expect(listMyClubs).toHaveBeenCalledTimes(2);
    who = B_USER; // another account, even without a forget: its own lookup
    await api.listStands();
    expect(listMyClubs).toHaveBeenCalledTimes(3);
  });

  it('shows the no-access state on a 403, not "Could not load this."', async () => {
    const session = new ClubSession(fakeCognitoAuth(), memoryTokenStore(tokensFor(SIGNED_IN)));
    const data = sampleData();
    const client = fakeClubClient(data);
    const listed = client.listMyClubs;
    let removed = false;
    // The admin was removed from the club: its calls answer 403 and /me/clubs then lists none.
    client.listMyClubs = async () => (removed ? [] : listed());
    client.listStands = async () => {
      removed = true;
      throw new ClubApiRequestError('forbidden', 403);
    };
    window.location.hash = '#/stands';
    render(<App session={session} api={adminApi(client, session)} />);
    expect(await screen.findByRole('heading', { name: NO_ACCESS_TITLE })).toBeTruthy();
    expect(screen.queryByText(LOAD_ERROR)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    const start = screen.getByRole('link', { name: 'Start a club' });
    expect(start.getAttribute('href')).toBe('#/club');
    fireEvent.click(start);
    go('#/club');
    // With the choice dropped, My club offers to start one.
    expect(await screen.findByRole('heading', { level: 1, name: 'My club' })).toBeTruthy();
  });
});
