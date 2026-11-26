import type { AuthTokens } from '@huntclub/shared';
import * as SecureStore from 'expo-secure-store';

import type { TokenStore } from './session';

const KEY = 'huntclub.club-auth';

/** Tokens in the iOS Keychain / Android Keystore, readable only after first unlock. */
export const secureTokenStore: TokenStore = {
  async load() {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as AuthTokens) : null;
  },
  save: (tokens) =>
    SecureStore.setItemAsync(KEY, JSON.stringify(tokens), {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    }),
  clear: () => SecureStore.deleteItemAsync(KEY),
};
