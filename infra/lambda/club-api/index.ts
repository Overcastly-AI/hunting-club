// Club API Lambda (Function URL). Configuration comes from the env vars the ApiStack
// sets (API_ENV); the handler itself lives in @huntclub/api.
import {
  clubDataForTable,
  cognitoVerifier,
  connectStripe,
  createClubApi,
  errorResponse,
  lazyHandler,
  mapPackStarter,
  missingEnv,
  readSecureParameter,
  type FunctionUrlEvent,
} from '@huntclub/api';
import { CHECKOUT_RETURN_PATHS } from '@huntclub/shared/app';
import { API_ENV, CLUB_API_SECRETS, secretParameterEnvVar } from '../../config/types';

const STRIPE_KEY_PARAM = secretParameterEnvVar('stripeApiKey');
const REQUIRED_ENV = [
  API_ENV.envName,
  API_ENV.tableName,
  API_ENV.userPoolId,
  API_ENV.userPoolClientIds,
  API_ENV.webOrigin,
  API_ENV.stripePrices,
  API_ENV.mapPackBuilder,
  ...CLUB_API_SECRETS.map(secretParameterEnvVar),
];

const env = (name: string) => process.env[name] ?? '';

const run = lazyHandler(async () => {
  const webOrigin = env(API_ENV.webOrigin);
  let stripe: ReturnType<typeof connectStripe> | undefined;
  return createClubApi({
    data: clubDataForTable(env(API_ENV.tableName)),
    verifier: cognitoVerifier({
      userPoolId: env(API_ENV.userPoolId),
      clientIds: env(API_ENV.userPoolClientIds).split(','),
    }),
    // The Stripe key is read only when an admin starts Checkout.
    stripe: async () =>
      (stripe ??= connectStripe(await readSecureParameter(env(STRIPE_KEY_PARAM)))).api,
    checkout: {
      prices: JSON.parse(env(API_ENV.stripePrices)) as Record<string, string>,
      successUrl: `${webOrigin}${CHECKOUT_RETURN_PATHS.success}`,
      cancelUrl: `${webOrigin}${CHECKOUT_RETURN_PATHS.cancel}`,
    },
    startMapPackBuild: mapPackStarter(env(API_ENV.mapPackBuilder)),
  });
});

export const handler = async (event: FunctionUrlEvent) => {
  const missing = missingEnv(REQUIRED_ENV);
  if (missing.length > 0) return errorResponse('not_configured', `missing ${missing.join(', ')}`);
  return run(event);
};
