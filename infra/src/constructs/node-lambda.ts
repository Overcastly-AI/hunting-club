import * as path from 'node:path';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

/** Log retention for every log group in the project (owner rule: 14 days). */
export const LOG_RETENTION = logs.RetentionDays.TWO_WEEKS;

export interface NodeLambdaProps {
  /** Folder name under infra/lambda/ containing index.ts. */
  readonly entry: string;
  readonly environment?: Record<string, string>;
  readonly timeout?: Duration;
  readonly memorySize?: number;
}

/**
 * The one way this project defines a Lambda: Node 24 on arm64 (cheapest), bundled by
 * esbuild, with its own log group capped at 14 days. No provisioned concurrency.
 */
export class NodeLambda extends Construct {
  readonly function: NodejsFunction;
  readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: NodeLambdaProps) {
    super(scope, id);

    this.logGroup = new logs.LogGroup(this, 'Logs', {
      retention: LOG_RETENTION,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.function = new NodejsFunction(this, 'Function', {
      entry: path.join(__dirname, '..', '..', 'lambda', props.entry, 'index.ts'),
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: props.memorySize ?? 256,
      timeout: props.timeout ?? Duration.seconds(10),
      logGroup: this.logGroup,
      environment: props.environment ?? {},
      bundling: {
        format: OutputFormat.ESM,
        target: 'node24',
        minify: true,
        sourceMap: true,
        // The Node runtime ships the AWS SDK v3; never bundle it.
        externalModules: ['@aws-sdk/*'],
      },
    });
  }
}
