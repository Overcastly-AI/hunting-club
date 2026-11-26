import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib';
import type * as cognito from 'aws-cdk-lib/aws-cognito';
import type * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import type { Construct } from 'constructs';
import { PARTITION_PREFIXES } from '@huntclub/club-data';
import {
  API_ENV,
  STRIPE_WEBHOOK_SECRETS,
  secretParameterName,
  secretParameterEnvVar,
  type EnvConfig,
} from '../../config';
import { NodeLambda } from '../constructs/node-lambda';

export interface ApiStackProps extends StackProps {
  readonly config: EnvConfig;
  readonly table: dynamodb.ITableV2;
  readonly userPool: cognito.IUserPool;
  readonly clients: readonly cognito.IUserPoolClient[];
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
  readonly clubApiUrl: lambda.FunctionUrl;
  readonly stripeWebhook: NodeLambda;
  readonly stripeWebhookUrl: lambda.FunctionUrl;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    const { config, table, userPool, clients } = props;

    // ---- Club API ----------------------------------------------------------------
    this.clubApi = new NodeLambda(this, 'ClubApi', {
      entry: 'club-api',
      environment: {
        [API_ENV.envName]: config.name,
        [API_ENV.tableName]: table.tableName,
        [API_ENV.userPoolId]: userPool.userPoolId,
        [API_ENV.userPoolClientIds]: clients.map((c) => c.userPoolClientId).join(','),
      },
    });
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
    const webhookEnv: Record<string, string> = {
      [API_ENV.envName]: config.name,
      [API_ENV.tableName]: table.tableName,
    };
    for (const key of STRIPE_WEBHOOK_SECRETS) {
      webhookEnv[secretParameterEnvVar(key)] = secretParameterName(config.name, key);
    }
    this.stripeWebhook = new NodeLambda(this, 'StripeWebhook', {
      entry: 'stripe-webhook',
      environment: webhookEnv,
    });

    // Least privilege: read exactly its SecureString parameters (created outside CDK, so
    // values never touch the repo), and decrypt them only through SSM, only for those
    // parameters (SSM puts the parameter ARN in the KMS encryption context).
    const parameters = STRIPE_WEBHOOK_SECRETS.map((key) =>
      ssm.StringParameter.fromSecureStringParameterAttributes(this, `Secret-${key}`, {
        parameterName: secretParameterName(config.name, key),
      }),
    );
    for (const parameter of parameters) parameter.grantRead(this.stripeWebhook.function);
    this.stripeWebhook.function.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['kms:Decrypt'],
        resources: [this.formatArn({ service: 'kms', resource: 'key', resourceName: '*' })],
        conditions: {
          StringEquals: {
            'kms:ViaService': `ssm.${this.region}.amazonaws.com`,
            'kms:EncryptionContext:PARAMETER_ARN': parameters.map((p) => p.parameterArn),
          },
        },
      }),
    );

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
