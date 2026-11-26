import type { AuthTokens } from '@huntclub/shared';

import { deleteSecret, getSecret, setSecret } from '../storage/secure';
import type { TokenStore } from './session';

const KEY = 'huntclub.club-auth';

/** Club sign-in tokens in the phone's keystore (via the app's one secure-storage helper). */
export const secureTokenStore: TokenStore = {
  async load() {
    const raw = await getSecret(KEY);
    return raw ? (JSON.parse(raw) as AuthTokens) : null;
  },
  save: (tokens) => setSecret(KEY, JSON.stringify(tokens)),
  clear: () => deleteSecret(KEY),
};
