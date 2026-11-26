// Stripe webhook Lambda (Function URL). Reads its two secrets from SSM once per
// container; the handler itself lives in @huntclub/api. Never logs bodies or secrets.
import {
  clubDataForTable,
  connectStripe,
  createStripeWebhook,
  errorResponse,
  lazyHandler,
  missingEnv,
  readSecureParameter,
  type FunctionUrlEvent,
} from '@huntclub/api';
import {
  API_ENV,
  STRIPE_WEBHOOK_SECRETS,
  type SecretKey,
  secretParameterEnvVar,
} from '../../config/types';

const REQUIRED_ENV = [
  API_ENV.envName,
  API_ENV.tableName,
  ...STRIPE_WEBHOOK_SECRETS.map(secretParameterEnvVar),
];

const param = (key: SecretKey) =>
  readSecureParameter(process.env[secretParameterEnvVar(key)] ?? '');

const run = lazyHandler(async () => {
  const [apiKey, webhookSecret] = await Promise.all([
    param('stripeApiKey'),
    param('stripeWebhookSecret'),
  ]);
  const stripe = connectStripe(apiKey);
  return createStripeWebhook({
    data: clubDataForTable(process.env[API_ENV.tableName] ?? ''),
    verify: stripe.verifier(webhookSecret),
    stripe: stripe.api,
  });
});

export const handler = async (event: FunctionUrlEvent) => {
  const missing = missingEnv(REQUIRED_ENV);
  if (missing.length > 0) return errorResponse('not_configured', `missing ${missing.join(', ')}`);
  return run(event);
};
