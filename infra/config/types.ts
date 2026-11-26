import type { StripePrices } from '@huntclub/shared';
/** Project-wide constants used by every environment. */
export const PROJECT = 'hunt-club-mesh';

/**
 * Secrets each Lambda may read. Values live only in SSM Parameter Store as SecureString
 * parameters (standard tier, free; encrypted with the default aws/ssm key).
 */
export type SecretKey = 'stripeWebhookSecret' | 'stripeApiKey';

const SECRET_SLUGS: Record<SecretKey, string> = {
  stripeWebhookSecret: 'stripe-webhook-secret',
  stripeApiKey: 'stripe-api-key',
};

/** Secrets the Stripe webhook Lambda may read (docs/research/stripe-and-auth.md §4). */
export const STRIPE_WEBHOOK_SECRETS: readonly SecretKey[] = ['stripeWebhookSecret', 'stripeApiKey'];

/** Secrets the club API may read (the Stripe key, only for creating Checkout Sessions). */
export const CLUB_API_SECRETS: readonly SecretKey[] = ['stripeApiKey'];

/** Env var that carries a secret's parameter NAME (never its value), e.g. STRIPE_WEBHOOK_SECRET_PARAM. */
export function secretParameterEnvVar(key: SecretKey): string {
  return `${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}_PARAM`;
}

/** Environment variable names the API Lambdas read; the stacks set them from here. */
export const API_ENV = {
  envName: 'ENV_NAME',
  tableName: 'TABLE_NAME',
  userPoolId: 'USER_POOL_ID',
  userPoolClientIds: 'USER_POOL_CLIENT_IDS',
  /** https origin of the web admin page (Checkout returns there). */
  webOrigin: 'WEB_ORIGIN',
  /** JSON object: plan id → Stripe Price id. */
  stripePrices: 'STRIPE_PRICES',
  /** Name of the map-pack builder Lambda (the club API starts it). */
  mapPackBuilder: 'MAP_PACK_BUILDER_FUNCTION',
  /** Bucket the map-pack builder writes packs/ into (the web stack's bucket). */
  mapPackBucket: 'MAP_PACK_BUCKET',
} as const;

/** SSM parameter name for a secret: `/hunt-club-mesh/<env>/<name>` (owner decision 2026-11-26). */
export function secretParameterName(env: string, key: SecretKey): string {
  return `/${PROJECT}/${env}/${SECRET_SLUGS[key]}`;
}

/** Everything that differs between environments. One file per environment in this folder. */
export interface EnvConfig {
  /** Short environment name, used in stack names, tags and secret names. */
  readonly name: string;
  readonly account: string;
  readonly region: string;
  /** Web admin page and universal-link domain (served by CloudFront). */
  readonly domainName: string;
  /** Whether search engines may index the web page (robots.txt). Only production should. */
  readonly searchIndexing: boolean;
  /** Route 53 hosted zone that holds `domainName`. */
  readonly hostedZoneId: string;
  /** ACM certificate in us-east-1 covering `domainName` (CloudFront requires us-east-1). */
  readonly certificateArn: string;
  /**
   * The club table and Cognito user pool. They are owned by a CloudFormation stack built
   * outside this repo (`dataStackName`); CDK only references them by these identifiers.
   */
  readonly dataStackName: string;
  /** Name of the club table; its ARN is derived from the env's account and region. */
  readonly clubTableName: string;
  /** Stripe (test mode in dev). */
  readonly stripe: {
    /**
     * Stripe Price id per plan id (club-data PLACEHOLDER_PLANS) and billing interval;
     * Checkout answers 503 without one. Unset in dev until the owner sets up Stripe.
     */
    readonly prices: StripePrices;
  };
  readonly cognito: {
    readonly userPoolId: string;
    /** Expo app client (USER_AUTH). */
    readonly appClientId: string;
    /** Web admin page client; set once it exists. */
    readonly webClientId?: string;
  };
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

/** Cognito client IDs the club API accepts, in a fixed order (app, then web once configured). */
export function userPoolClientIds(config: { readonly cognito: EnvConfig['cognito'] }): string[] {
  return [config.cognito.appClientId, config.cognito.webClientId].filter((id): id is string =>
    Boolean(id),
  );
}
