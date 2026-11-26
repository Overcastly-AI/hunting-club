/**
 * Wiring the shared clients to this app: which cloud environment, and fetch.
 * The ids come from @huntclub/shared/cloud (the same values infra uses).
 */
import {
  CLOUD_ENVIRONMENTS,
  ClubSession,
  type CloudEnvironment,
  createClubApiClient,
  createCognitoAuth,
  type FetchLike,
  type WEB_DOMAINS,
} from '@huntclub/shared';

import { secureStorage } from '../storage/secure';
import { appMapPackFiles } from './mapPackFiles';
import { secureTokenStore } from './secureTokenStore';

/** The app talks to dev until a production environment exists. */
const ENVIRONMENT_NAME = 'dev' as const satisfies keyof typeof CLOUD_ENVIRONMENTS &
  keyof typeof WEB_DOMAINS;
const ENVIRONMENT: CloudEnvironment = CLOUD_ENVIRONMENTS[ENVIRONMENT_NAME];

/** The club API URL; until it's deployed, club sign-in shows "not available yet". */
export const CLUB_API_URL: string | undefined =
  ENVIRONMENT.clubApiUrl ?? process.env.EXPO_PUBLIC_CLUB_API_URL;

const appFetch: FetchLike = (url, init) => fetch(url, init);

export function createAppClubServices() {
  const auth = createCognitoAuth({
    region: ENVIRONMENT.region,
    clientId: ENVIRONMENT.appClientId,
    fetch: appFetch,
  });
  const session = new ClubSession(auth, secureTokenStore);
  const api = CLUB_API_URL
    ? createClubApiClient({
        baseUrl: CLUB_API_URL,
        fetch: appFetch,
        accessToken: () => session.accessToken(),
        refresh: () => session.refresh(),
      })
    : undefined;
  return {
    session,
    api,
    secrets: secureStorage,
    mapPacks: { files: appMapPackFiles, env: ENVIRONMENT_NAME },
  };
}
