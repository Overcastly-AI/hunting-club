import { type AuthTokens, SECURE_KEYS, type TokenStore } from '@huntclub/shared';

const KEY = SECURE_KEYS.webClubRefreshToken;

/** Browser storage, or undefined where it is blocked (private mode, disabled cookies). */
function defaultStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * The web admin's tokens: access token in memory only, refresh token also in browser
 * storage so a reload, deep link or invite link keeps the admin signed in. A stored
 * refresh token comes back with an expired access token, so the session refreshes first.
 * Every storage call is guarded: without storage the admin simply signs in each visit.
 */
export function browserTokenStore(storage: () => Storage | undefined = defaultStorage): TokenStore {
  let tokens: AuthTokens | null = null;
  const attempt = <T>(fn: (s: Storage) => T): T | undefined => {
    try {
      const s = storage();
      return s ? fn(s) : undefined;
    } catch {
      return undefined;
    }
  };
  return {
    async load() {
      if (tokens) return tokens;
      const refreshToken = attempt((s) => s.getItem(KEY));
      return refreshToken ? { accessToken: '', refreshToken, expiresAt: 0 } : null;
    },
    async save(next) {
      tokens = next;
      attempt((s) => s.setItem(KEY, next.refreshToken));
    },
    async clear() {
      tokens = null;
      attempt((s) => s.removeItem(KEY));
    },
  };
}
