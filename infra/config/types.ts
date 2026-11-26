/** Project-wide constants used by every environment. */
export const PROJECT = 'hunt-club-mesh';

/** Names of the secrets each Lambda may read. Values live only in AWS Secrets Manager. */
export type SecretKey = 'stripeWebhookSecret' | 'stripeApiKey';

const SECRET_SLUGS: Record<SecretKey, string> = {
  stripeWebhookSecret: 'stripe-webhook-secret',
  stripeApiKey: 'stripe-api-key',
};

/** Secrets the Stripe webhook Lambda may read (docs/research/stripe-and-auth.md §4). */
export const STRIPE_WEBHOOK_SECRETS: readonly SecretKey[] = ['stripeWebhookSecret', 'stripeApiKey'];

/** Env var that carries a secret's NAME (never its value), e.g. STRIPE_WEBHOOK_SECRET_NAME. */
export function secretNameEnvVar(key: SecretKey): string {
  return `${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}_NAME`;
}

/** Environment variable names the API Lambdas read; the stacks set them from here. */
export const API_ENV = {
  envName: 'ENV_NAME',
  tableName: 'TABLE_NAME',
  userPoolId: 'USER_POOL_ID',
  userPoolClientIds: 'USER_POOL_CLIENT_IDS',
} as const;

/** Secrets Manager name for a secret, following the owner's `hunt-club-mesh/<env>/<name>` scheme. */
export function secretName(env: string, key: SecretKey): string {
  return `${PROJECT}/${env}/${SECRET_SLUGS[key]}`;
}

/** Everything that differs between environments. One file per environment in this folder. */
export interface EnvConfig {
  /** Short environment name, used in stack names, tags and secret names. */
  readonly name: string;
  readonly account: string;
  readonly region: string;
  /** Web admin page and universal-link domain (served by CloudFront). */
  readonly domainName: string;
  /** Route 53 hosted zone that holds `domainName`. */
  readonly hostedZoneId: string;
  /** ACM certificate in us-east-1 covering `domainName` (CloudFront requires us-east-1). */
  readonly certificateArn: string;
  /**
   * DynamoDB point-in-time recovery. Off in dev to stay in the free tier; the cost guard
   * fails a dev synth that turns it on.
   */
  readonly pointInTimeRecovery: boolean;
  /**
   * Universal / app link verification. Files are only published once these are known:
   * Apple needs the developer Team ID; Android needs the signing certificates' SHA-256
   * fingerprints (from `eas credentials` / Play App Signing).
   */
  readonly appLinks: {
    readonly appleTeamId?: string;
    readonly androidSha256CertFingerprints: readonly string[];
  };
}
