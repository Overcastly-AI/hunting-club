import type { AuthTokens, CognitoAuth } from '@huntclub/shared';
import { CognitoAuthError } from '@huntclub/shared';

import { ClubSession, type TokenStore } from '../session';

const memoryStore = (
  initial: AuthTokens | null = null,
): TokenStore & { value: AuthTokens | null } => {
  const store = {
    value: initial,
    load: async () => store.value,
    save: async (t: AuthTokens) => {
      store.value = t;
    },
    clear: async () => {
      store.value = null;
    },
  };
  return store;
};

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
  const store = memoryStore();
  const auth = fakeAuth();
  const session = new ClubSession(auth, store, () => 0);
  const challenge = await session.requestCode('  Max@Example.com ');
  expect(auth.requestCode).toHaveBeenCalledWith('max@example.com');
  await session.confirmCode(challenge, ' 123456 ');
  expect(store.value?.accessToken).toBe('a10000000');
  expect(await session.isSignedIn()).toBe(true);
});

it('uses the stored token until a minute before expiry, then refreshes', async () => {
  let now = 0;
  const auth = fakeAuth();
  const session = new ClubSession(auth, memoryStore(tokens(120_000)), () => now);
  expect(await session.accessToken()).toBe('a120000');
  now = 61_000;
  expect(await session.accessToken()).toBe('a20000000');
  expect(auth.refresh).toHaveBeenCalledTimes(1);
});

it('signs out locally when the refresh token is no longer valid, but not when offline', async () => {
  const offline = new ClubSession(
    fakeAuth({ refresh: async () => Promise.reject(new CognitoAuthError('network')) }),
    memoryStore(tokens(0)),
    () => 1,
  );
  expect(await offline.accessToken()).toBeUndefined();
  expect(await offline.isSignedIn()).toBe(true);

  const store = memoryStore(tokens(0));
  const revoked = new ClubSession(
    fakeAuth({ refresh: async () => Promise.reject(new CognitoAuthError('code_expired')) }),
    store,
    () => 1,
  );
  expect(await revoked.refresh()).toBe(false);
  expect(store.value).toBeNull();
});

it('sign out clears the keystore and revokes the refresh token', async () => {
  const store = memoryStore(tokens(1));
  const auth = fakeAuth();
  await new ClubSession(auth, store).signOut();
  expect(store.value).toBeNull();
  expect(auth.revoke).toHaveBeenCalledWith('r');
});
