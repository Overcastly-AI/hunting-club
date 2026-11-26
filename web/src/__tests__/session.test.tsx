import { ClubSession, CognitoAuthError, SECURE_KEYS } from '@huntclub/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { adminApi } from '../api/admin';
import { App, SESSION_EXPIRED } from '../App';
import { browserTokenStore, signedInEmail } from '../tokenStore';
import { fakeClubClient, fakeCognitoAuth, sampleData } from './fakeClubApi';

const KEY = SECURE_KEYS.webClubRefreshToken;

/** A Storage stand-in: an in-memory map, or one that throws like blocked storage. */
function memoryStorage(blocked = false): Storage {
  const items = new Map<string, string>();
  const guard = () => {
    if (blocked) throw new DOMException('blocked', 'SecurityError');
  };
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    key: (i) => [...items.keys()][i] ?? null,
    getItem: (k) => (guard(), items.get(k) ?? null),
    setItem: (k, v) => (guard(), void items.set(k, v)),
    removeItem: (k) => (guard(), void items.delete(k)),
  };
}

/** A Cognito access token (JWT) whose username is the email. */
const jwt = (username: string) => `h.${btoa(JSON.stringify({ username })).replace(/=+$/, '')}.s`;

describe('browserTokenStore', () => {
  it('keeps only the refresh token in storage, and returns it expired so it refreshes first', async () => {
    const storage = memoryStorage();
    await browserTokenStore(() => storage).save({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 3_600_000,
    });
    expect([...Array(storage.length)].map((_, i) => storage.key(i))).toEqual([KEY]);
    expect(storage.getItem(KEY)).toBe('refresh');
    // A new page load (a fresh store over the same storage).
    expect(await browserTokenStore(() => storage).load()).toEqual({
      accessToken: '',
      refreshToken: 'refresh',
      expiresAt: 0,
    });
    await browserTokenStore(() => storage).clear();
    expect(storage.getItem(KEY)).toBeNull();
  });

  it('works without storage (blocked or missing): memory only, no errors', async () => {
    for (const storage of [() => memoryStorage(true), () => undefined]) {
      const store = browserTokenStore(storage);
      const tokens = { accessToken: 'a', refreshToken: 'r', expiresAt: 1 };
      await store.save(tokens);
      expect(await store.load()).toEqual(tokens);
      await store.clear();
      expect(await store.load()).toBeNull();
    }
  });

  it('reads the email from the access token, or nothing', () => {
    expect(signedInEmail(jwt('dale@example.com'))).toBe('dale@example.com');
    expect(signedInEmail(jwt('5f1c-uuid'))).toBeUndefined();
    expect(signedInEmail('not a jwt')).toBeUndefined();
    expect(signedInEmail(undefined)).toBeUndefined();
  });
});

describe('the web session across reloads', () => {
  function load(storage: Storage, auth = fakeCognitoAuth()) {
    const session = new ClubSession(
      auth,
      browserTokenStore(() => storage),
    );
    return render(<App session={session} api={adminApi(fakeClubClient(sampleData()))} />);
  }

  it('stays signed in after a reload, on the route that was asked for', async () => {
    const storage = memoryStorage();
    storage.setItem(KEY, 'kept-refresh-token');
    const auth = fakeCognitoAuth();
    auth.refresh = vi.fn(async () => ({
      accessToken: jwt('dale@example.com'),
      refreshToken: 'kept-refresh-token',
      expiresAt: Date.now() + 3_600_000,
    }));
    window.location.hash = '#/stands';
    load(storage, auth);
    expect(await screen.findByRole('heading', { level: 1, name: 'Stands and areas' })).toBeTruthy();
    expect(auth.refresh).toHaveBeenCalledWith('kept-refresh-token');
    expect(screen.getByText('Signed in as dale@example.com')).toBeTruthy();
  });

  it('asks to sign in again when the kept session cannot be refreshed', async () => {
    const storage = memoryStorage();
    storage.setItem(KEY, 'revoked');
    const auth = fakeCognitoAuth();
    auth.refresh = vi.fn(async () => Promise.reject(new CognitoAuthError('code_expired')));
    load(storage, auth);
    expect((await screen.findByText(SESSION_EXPIRED)).getAttribute('role')).toBe('status');
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeTruthy();
    expect(storage.getItem(KEY)).toBeNull();
  });

  it('revokes and forgets the token on sign out', async () => {
    const storage = memoryStorage();
    storage.setItem(KEY, 'kept');
    const auth = fakeCognitoAuth();
    auth.revoke = vi.fn(async () => undefined);
    window.location.hash = '';
    load(storage, auth);
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    await screen.findByRole('heading', { level: 1, name: 'Sign in' });
    expect(auth.revoke).toHaveBeenCalledWith('r');
    expect(storage.getItem(KEY)).toBeNull();
  });
});

describe('pages before there is a club', () => {
  it.each([
    ['#/roster', 'Roster'],
    ['#/stands', 'Stands and areas'],
    ['#/harvests', 'Harvests'],
    ['#/maps', 'Map packs'],
  ])('%s asks to create the club first, not an error', async (hash, heading) => {
    const storage = memoryStorage();
    storage.setItem(KEY, 'kept');
    window.location.hash = hash;
    const session = new ClubSession(
      fakeCognitoAuth(),
      browserTokenStore(() => storage),
    );
    render(
      <App session={session} api={adminApi(fakeClubClient({ ...sampleData(), club: null }))} />,
    );
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeTruthy();
    expect(await screen.findByText(/Create your club first/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Go to My club' }).getAttribute('href')).toBe('#/club');
    expect(screen.queryByText(/Could not load this/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Make an invite' })).toBeNull();
  });
});
