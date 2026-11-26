import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import type * as s3 from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import type { Construct } from 'constructs';
import { PARTITION_PREFIXES } from '@huntclub/club-data';
import { MAP_PACKS_PREFIX } from '@huntclub/shared/maps';
import {
  API_ENV,
  CLUB_API_SECRETS,
  STRIPE_WEBHOOK_SECRETS,
  type SecretKey,
  secretParameterName,
  secretParameterEnvVar,
  userPoolClientIds,
  type EnvConfig,
} from '../../config';
import { NodeLambda } from '../constructs/node-lambda';

export interface ApiStackProps extends StackProps {
  readonly config: EnvConfig;
  /** The web stack's bucket: map packs go under packs/ and are served by its CloudFront. */
  readonly packBucket: s3.IBucket;
}

/** Item actions the map-pack builder needs to record a pack (club ConditionCheck + Put). */
export const MAP_PACK_BUILDER_TABLE_ACTIONS = [
  'dynamodb:GetItem',
  'dynamodb:PutItem',
  'dynamodb:ConditionCheckItem',
];

/** A pack build is bounded by the tile cap and the polite fetch rate; Lambda's maximum. */
export const MAP_PACK_BUILD_TIMEOUT = Duration.minutes(15);

/** ARN of the externally owned club table, in the stack's (explicit) account and region. */
export function clubTableArn(stack: Stack, config: EnvConfig): string {
  return stack.formatArn({
    service: 'dynamodb',
    resource: 'table',
    resourceName: config.clubTableName,
  });
}

/** Env vars carrying the secrets' parameter NAMES (never values). */
function secretEnvironment(config: EnvConfig, keys: readonly SecretKey[]): Record<string, string> {
  return Object.fromEntries(
    keys.map((key) => [secretParameterEnvVar(key), secretParameterName(config.name, key)]),
  );
}

/**
 * Least privilege: the function reads exactly these SecureString parameters (created
 * outside CDK, so values never touch the repo), and decrypts them only through SSM,
 * only for those parameters (SSM puts the parameter ARN in the KMS encryption context).
 */
function grantSecretReads(fn: NodeLambda, config: EnvConfig, keys: readonly SecretKey[]) {
  const stack = Stack.of(fn);
  const parameters = keys.map((key) =>
    ssm.StringParameter.fromSecureStringParameterAttributes(fn, `Secret-${key}`, {
      parameterName: secretParameterName(config.name, key),
    }),
  );
  for (const parameter of parameters) parameter.grantRead(fn.function);
  fn.function.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ['kms:Decrypt'],
      resources: [stack.formatArn({ service: 'kms', resource: 'key', resourceName: '*' })],
      conditions: {
        StringEquals: {
          'kms:ViaService': `ssm.${stack.region}.amazonaws.com`,
          'kms:EncryptionContext:PARAMETER_ARN': parameters.map((p) => p.parameterArn),
        },
      },
    }),
  );
}

/** Data actions the club API needs (no Scan, no streams, no table management). */
export const CLUB_API_TABLE_ACTIONS = [
  'dynamodb:GetItem',
  'dynamodb:BatchGetItem',
  'dynamodb:Query',
  'dynamodb:PutItem',
  'dynamodb:UpdateItem',
  'dynamodb:DeleteItem',
  'dynamodb:BatchWriteItem',
  'dynamodb:ConditionCheckItem',
];

/** Item actions the Stripe webhook needs to record events and upsert subscriptions. */
export const STRIPE_WEBHOOK_TABLE_ACTIONS = [
  'dynamodb:GetItem',
  'dynamodb:PutItem',
  'dynamodb:UpdateItem',
  'dynamodb:ConditionCheckItem',
];

/**
 * Pay-per-use HTTP endpoints: Lambda Function URLs, no API Gateway.
 * - Club API: every request must carry a Cognito access token (checked in the handler).
 * - Stripe webhook: public (Stripe signs requests); may touch only billing partitions.
 * Both handlers are stubs until Milestone 9 wires real logic.
 */
export class ApiStack extends Stack {
  readonly clubApi: NodeLambda;
  readonly mapPackBuilder: NodeLambda;
  readonly clubApiUrl: lambda.FunctionUrl;
  readonly stripeWebhook: NodeLambda;
  readonly stripeWebhookUrl: lambda.FunctionUrl;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    const { config } = props;

    // Referenced, not created: the table and user pool belong to config.dataStackName.
    const table = dynamodb.Table.fromTableAttributes(this, 'ClubTable', {
      tableArn: clubTableArn(this, config),
      grantIndexPermissions: true,
    });
    const userPool = cognito.UserPool.fromUserPoolId(this, 'Users', config.cognito.userPoolId);
    const clientIds = userPoolClientIds(config);

    // ---- Map-pack builder (on demand: the club API invokes it asynchronously) -----------
    this.mapPackBuilder = new NodeLambda(this, 'MapPackBuilder', {
      entry: 'map-pack-builder',
      timeout: MAP_PACK_BUILD_TIMEOUT,
      memorySize: 1024,
      environment: {
        [API_ENV.envName]: config.name,
        [API_ENV.tableName]: table.tableName,
        [API_ENV.mapPackBucket]: props.packBucket.bucketName,
        [API_ENV.webOrigin]: `https://${config.domainName}`,
      },
    });
    // One retry for a failed build; old requests are dropped rather than built late.
    this.mapPackBuilder.function.configureAsyncInvoke({
      retryAttempts: 1,
      maxEventAge: Duration.hours(1),
    });
    props.packBucket.grantPut(this.mapPackBuilder.function, `${MAP_PACKS_PREFIX}*`);
    table.grant(this.mapPackBuilder.function, ...MAP_PACK_BUILDER_TABLE_ACTIONS);

    // ---- Club API ----------------------------------------------------------------
    this.clubApi = new NodeLambda(this, 'ClubApi', {
      entry: 'club-api',
      environment: {
        [API_ENV.envName]: config.name,
        [API_ENV.tableName]: table.tableName,
        [API_ENV.userPoolId]: userPool.userPoolId,
        [API_ENV.userPoolClientIds]: clientIds.join(','),
        [API_ENV.webOrigin]: `https://${config.domainName}`,
        [API_ENV.stripePrices]: JSON.stringify(config.stripe.prices),
        [API_ENV.mapPackBuilder]: this.mapPackBuilder.function.functionName,
        ...secretEnvironment(config, CLUB_API_SECRETS),
      },
    });
    this.mapPackBuilder.function.grantInvoke(this.clubApi.function);
    grantSecretReads(this.clubApi, config, CLUB_API_SECRETS);
    // Table and its indexes; permissions per club are enforced in the API (tested in M9).
    table.grant(this.clubApi.function, ...CLUB_API_TABLE_ACTIONS);
    // Cognito can't authorize Function URLs directly: the handler verifies the JWT.
    this.clubApiUrl = this.clubApi.function.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: [`https://${config.domainName}`],
        allowedMethods: [lambda.HttpMethod.ALL],
        allowedHeaders: ['authorization', 'content-type'],
      },
    });

    // ---- Stripe webhook --------------------------------------------------------------
    this.stripeWebhook = new NodeLambda(this, 'StripeWebhook', {
      entry: 'stripe-webhook',
      environment: {
        [API_ENV.envName]: config.name,
        [API_ENV.tableName]: table.tableName,
        ...secretEnvironment(config, STRIPE_WEBHOOK_SECRETS),
      },
    });
    grantSecretReads(this.stripeWebhook, config, STRIPE_WEBHOOK_SECRETS);

    // Only items whose partition key starts with a billing prefix (subscriptions, processed
    // Stripe events): IAM checks every item's partition key via dynamodb:LeadingKeys.
    this.stripeWebhook.function.addToRolePolicy(
      new iam.PolicyStatement({
        actions: STRIPE_WEBHOOK_TABLE_ACTIONS,
        resources: [table.tableArn],
        conditions: {
          'ForAllValues:StringLike': {
            'dynamodb:LeadingKeys': Object.values(PARTITION_PREFIXES).map((p) => `${p}*`),
          },
        },
      }),
    );

    // Stripe cannot sign AWS SigV4 requests, so the URL is public; the handler verifies
    // Stripe's signature before doing anything (Milestone 9).
    this.stripeWebhookUrl = this.stripeWebhook.function.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    new CfnOutput(this, 'ClubApiUrl', { value: this.clubApiUrl.url });
    new CfnOutput(this, 'StripeWebhookUrl', { value: this.stripeWebhookUrl.url });
  }
}
