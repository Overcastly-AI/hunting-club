import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import type { Construct } from 'constructs';
import { STRIPE_WEBHOOK_SECRETS, secretName, secretNameEnvVar, type EnvConfig } from '../../config';
import { NodeLambda } from '../constructs/node-lambda';

export interface ApiStackProps extends StackProps {
  readonly config: EnvConfig;
}

/**
 * Pay-per-use HTTP endpoints: Lambda Function URLs, no API Gateway.
 * Milestone 9 fills in the Stripe webhook; today it is a stub that proves the wiring.
 */
export class ApiStack extends Stack {
  readonly stripeWebhook: NodeLambda;
  readonly stripeWebhookUrl: lambda.FunctionUrl;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    const { config } = props;

    const environment: Record<string, string> = { ENV_NAME: config.name };
    for (const key of STRIPE_WEBHOOK_SECRETS) {
      environment[secretNameEnvVar(key)] = secretName(config.name, key);
    }

    this.stripeWebhook = new NodeLambda(this, 'StripeWebhook', {
      entry: 'stripe-webhook',
      environment,
    });

    // Least privilege: read exactly these secrets, nothing else. The secrets themselves
    // are created outside CDK (values never touch the repo).
    for (const key of STRIPE_WEBHOOK_SECRETS) {
      secretsmanager.Secret.fromSecretNameV2(
        this,
        `Secret-${key}`,
        secretName(config.name, key),
      ).grantRead(this.stripeWebhook.function);
    }

    // Stripe cannot sign AWS SigV4 requests, so the URL is public; the handler verifies
    // Stripe's signature before doing anything (Milestone 9).
    this.stripeWebhookUrl = this.stripeWebhook.function.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    new CfnOutput(this, 'StripeWebhookUrl', { value: this.stripeWebhookUrl.url });
  }
}
