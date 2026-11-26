// Stripe webhook (Lambda Function URL). STUB until Milestone 9: it checks that the
// deployment wired up the table and secret names, then answers 501 so Stripe keeps
// retrying. It never reads secret values and never logs request bodies (CLAUDE.md).
import { API_ENV, STRIPE_WEBHOOK_SECRETS, secretParameterEnvVar } from '../../config/types';
import { jsonResponse, missingEnv, type FunctionUrlEvent, type FunctionUrlResult } from '../http';

const REQUIRED_ENV = [
  API_ENV.envName,
  API_ENV.tableName,
  ...STRIPE_WEBHOOK_SECRETS.map(secretParameterEnvVar),
];

export const handler = async (event: FunctionUrlEvent): Promise<FunctionUrlResult> => {
  const missing = missingEnv(REQUIRED_ENV);
  const method = event.requestContext?.http?.method ?? 'UNKNOWN';
  console.log(JSON.stringify({ msg: 'stripe-webhook stub', method, missing }));

  return missing.length > 0
    ? jsonResponse(500, { error: 'misconfigured', missing })
    : jsonResponse(501, {
        error: 'not_implemented',
        detail: 'Stripe webhook arrives in Milestone 9',
      });
};
