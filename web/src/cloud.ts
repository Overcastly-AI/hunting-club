/**
 * Wiring the shared clients to the web admin. The ids come from @huntclub/shared/cloud,
 * the same values the app and infra use.
 */
import {
  CLOUD_ENVIRONMENTS,
  ClubSession,
  createClubApiClient,
  createCognitoAuth,
  type CloudEnvironment,
  type FetchLike,
  memoryTokenStore,
} from '@huntclub/shared';
import { adminApi } from './api/admin';
import type { ClubApi } from './api/types';

/** The web admin talks to dev until a production environment exists. */
const ENVIRONMENT: CloudEnvironment = CLOUD_ENVIRONMENTS.dev;

const webFetch: FetchLike = (url, init) => fetch(url, init);

export interface WebClubServices {
  /** Undefined until the web app client exists; the page then says sign-in is not ready. */
  session: ClubSession | undefined;
  /** Undefined until the club API is deployed. */
  api: ClubApi | undefined;
}

export function createWebClubServices(env: CloudEnvironment = ENVIRONMENT): WebClubServices {
  if (!env.webClientId) return { session: undefined, api: undefined };
  const auth = createCognitoAuth({
    region: env.region,
    clientId: env.webClientId,
    fetch: webFetch,
  });
  // Tokens stay in memory: a reload means signing in again, and nothing sits in browser storage.
  const session = new ClubSession(auth, memoryTokenStore());
  const api = env.clubApiUrl
    ? adminApi(
        createClubApiClient({
          baseUrl: env.clubApiUrl,
          fetch: webFetch,
          accessToken: () => session.accessToken(),
          refresh: () => session.refresh(),
        }),
      )
    : undefined;
  return { session, api };
}
