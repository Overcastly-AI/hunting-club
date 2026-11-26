import { type AuthTokens, type CognitoAuth, CognitoAuthError, userFromIdToken } from '../cognito';
import { fakeIdToken } from '../testing';
import { ClubSession, memoryTokenStore } from '../session';

const tokens = (expiresAt: number): AuthTokens => ({
  accessToken: `a${expiresAt}`,
  refreshToken: 'r',
  expiresAt,
});
const fakeAuth = (overrides: Partial<CognitoAuth> = {}) =>
  ({
    requestCode: jest.fn(async (email: string) => ({ kind: 'signIn', email, session: 's' })),
    confirmCode: jest.fn(async () => tokens(10_000_000)),
    refresh: jest.fn(async () => tokens(20_000_000)),
    revoke: jest.fn(async () => undefined),
    ...overrides,
  }) as unknown as CognitoAuth;

it('signs in with the emailed code and stores the tokens', async () => {
  const store = memoryTokenStore();
  const auth = fakeAuth();
  const session = new ClubSession(auth, store, () => 0);
  const challenge = await session.requestCode('  Max@Example.com ');
  expect(auth.requestCode).toHaveBeenCalledWith('max@example.com');
  await session.confirmCode(challenge, ' 123456 ');
  expect((await store.load())?.accessToken).toBe('a10000000');
  expect(await session.isSignedIn()).toBe(true);
});

it('uses the stored token until a minute before expiry, then refreshes', async () => {
  let now = 0;
  const auth = fakeAuth();
  const session = new ClubSession(auth, memoryTokenStore(tokens(120_000)), () => now);
  expect(await session.accessToken()).toBe('a120000');
  now = 61_000;
  expect(await session.accessToken()).toBe('a20000000');
  expect(auth.refresh).toHaveBeenCalledTimes(1);
});

it('signs out locally when the refresh token is no longer valid, but not when offline', async () => {
  const offline = new ClubSession(
    fakeAuth({ refresh: async () => Promise.reject(new CognitoAuthError('network')) }),
    memoryTokenStore(tokens(0)),
    () => 1,
  );
  expect(await offline.accessToken()).toBeUndefined();
  expect(await offline.isSignedIn()).toBe(true);

  const store = memoryTokenStore(tokens(0));
  const revoked = new ClubSession(
    fakeAuth({ refresh: async () => Promise.reject(new CognitoAuthError('code_expired')) }),
    store,
    () => 1,
  );
  expect(await revoked.refresh()).toBe(false);
  expect(await store.load()).toBeNull();
});

it('sign out clears the keystore and revokes the refresh token', async () => {
  const store = memoryTokenStore(tokens(1));
  const auth = fakeAuth();
  await new ClubSession(auth, store).signOut();
  expect(await store.load()).toBeNull();
  expect(auth.revoke).toHaveBeenCalledWith('r');
});

it('knows who signed in from the ID token, and again after a restore and refresh', async () => {
  const dale = { userId: 'sub-dale', email: 'dale@example.com' };
  const withId = (expiresAt: number) => ({ ...tokens(expiresAt), idToken: fakeIdToken(dale) });
  const auth = fakeAuth({ refresh: jest.fn(async () => withId(20_000_000)) });
  // Stored tokens carry only the refresh token (browser storage): no user until a refresh.
  const restored = new ClubSession(auth, memoryTokenStore(tokens(0)), () => 1);
  expect(await restored.user()).toBeUndefined();
  await restored.refresh();
  expect(await restored.user()).toEqual(dale);
});

it('reads no user from a missing or broken ID token', () => {
  expect(userFromIdToken(undefined)).toBeUndefined();
  expect(userFromIdToken('not-a-jwt')).toBeUndefined();
  expect(userFromIdToken(fakeIdToken({ userId: 's' }))).toEqual({ userId: 's' });
});
