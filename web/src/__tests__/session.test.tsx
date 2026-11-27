import { ClubSession, CognitoAuthError, SECURE_KEYS } from '@huntclub/shared';
import { render, screen } from '@testing-library/react';
import { adminApi } from '../api/admin';
import { App, SESSION_EXPIRED } from '../App';
import { browserTokenStore } from '../tokenStore';
import { fakeIdToken } from '@huntclub/shared/testing';
import { fakeClubClient, fakeCognitoAuth, SIGNED_IN, sampleData } from '../testing/fakeClubApi';
import { accountButton, signIn, signOutFromMenu } from '../testing/shell';

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
      accessToken: 'a',
      idToken: fakeIdToken(SIGNED_IN),
      refreshToken: 'kept-refresh-token',
      expiresAt: Date.now() + 3_600_000,
    }));
    window.location.hash = '#/stands';
    load(storage, auth);
    expect(await screen.findByRole('heading', { level: 1, name: 'Stands and areas' })).toBeTruthy();
    expect(auth.refresh).toHaveBeenCalledWith('kept-refresh-token');
    expect((await accountButton()).textContent).toContain(SIGNED_IN.email);
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

  it('gives a fresh visitor on a deep link plain sign-in, then opens that page', async () => {
    const storage = memoryStorage();
    const auth = fakeCognitoAuth();
    auth.refresh = vi.fn(auth.refresh);
    window.location.hash = '#/roster';
    load(storage, auth);
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeTruthy();
    // Nothing was kept, so nothing expired: no notice, and no refresh was tried.
    expect(screen.queryByText(SESSION_EXPIRED)).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(auth.refresh).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('#/roster');
    await signIn();
    expect(await screen.findByRole('heading', { level: 1, name: 'Roster' })).toBeTruthy();
  });

  it('says the session expired only for a kept one that did, and restores the deep link', async () => {
    const storage = memoryStorage();
    storage.setItem(KEY, 'expired');
    const auth = fakeCognitoAuth();
    const refresh = auth.refresh;
    auth.refresh = vi.fn(async () => Promise.reject(new CognitoAuthError('code_expired')));
    window.location.hash = '#/stands';
    load(storage, auth);
    expect(await screen.findByText(SESSION_EXPIRED)).toBeTruthy();
    auth.refresh = refresh;
    await signIn();
    expect(await screen.findByRole('heading', { level: 1, name: 'Stands and areas' })).toBeTruthy();
  });

  it('does not say expired when the refresh failed for another reason (no connection)', async () => {
    const storage = memoryStorage();
    storage.setItem(KEY, 'kept');
    const auth = fakeCognitoAuth();
    auth.refresh = vi.fn(async () => Promise.reject(new TypeError('Failed to fetch')));
    window.location.hash = '#/roster';
    load(storage, auth);
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeTruthy();
    expect(screen.queryByText(SESSION_EXPIRED)).toBeNull();
    // The kept session is not thrown away for a network error.
    expect(storage.getItem(KEY)).toBe('kept');
  });

  it('revokes and forgets the token on sign out', async () => {
    const storage = memoryStorage();
    storage.setItem(KEY, 'kept');
    const auth = fakeCognitoAuth();
    auth.revoke = vi.fn(async () => undefined);
    window.location.hash = '';
    load(storage, auth);
    await signOutFromMenu();
    await screen.findByRole('heading', { level: 1, name: 'Sign in' });
    // Asked for, so never "session expired".
    expect(screen.queryByText(SESSION_EXPIRED)).toBeNull();
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
    expect(screen.queryByRole('button', { name: 'Invite members' })).toBeNull();
  });
});
