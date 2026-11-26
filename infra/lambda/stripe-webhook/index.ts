// Stripe webhook (Lambda Function URL). STUB until Milestone 9: it checks that the
// deployment wired up the secret names, then answers 501 so Stripe keeps retrying.
// It never reads secret values and never logs request bodies (CLAUDE.md).
import { STRIPE_WEBHOOK_SECRETS, secretNameEnvVar } from '../../config/types';

interface FunctionUrlEvent {
  readonly requestContext?: { readonly http?: { readonly method?: string } };
}

interface FunctionUrlResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const REQUIRED_ENV = ['ENV_NAME', ...STRIPE_WEBHOOK_SECRETS.map(secretNameEnvVar)];

export const handler = async (event: FunctionUrlEvent): Promise<FunctionUrlResult> => {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  const method = event.requestContext?.http?.method ?? 'UNKNOWN';
  console.log(JSON.stringify({ msg: 'stripe-webhook stub', method, missing }));

  return {
    statusCode: missing.length > 0 ? 500 : 501,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(
      missing.length > 0
        ? { error: 'misconfigured', missing }
        : { error: 'not_implemented', detail: 'Stripe webhook arrives in Milestone 9' },
    ),
  };
};
