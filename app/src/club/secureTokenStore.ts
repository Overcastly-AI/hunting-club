import type { AuthTokens, TokenStore } from '@huntclub/shared';

import { SECURE_KEYS, secureStorage } from '../storage/secure';

/** Club sign-in tokens in the phone's keystore (the app's one secure-storage helper). */
export const secureTokenStore: TokenStore = {
  async load() {
    const raw = await secureStorage.get(SECURE_KEYS.clubAuthTokens);
    return raw ? (JSON.parse(raw) as AuthTokens) : null;
  },
  save: (tokens) => secureStorage.set(SECURE_KEYS.clubAuthTokens, JSON.stringify(tokens)),
  clear: () => secureStorage.delete(SECURE_KEYS.clubAuthTokens),
};
