import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { lambdaEntry } from '../paths';

/** Log retention for every log group in the project (owner rule: 14 days). */
export const LOG_RETENTION = logs.RetentionDays.TWO_WEEKS;

/**
 * esbuild settings shared by every Lambda bundle (and by the bundle test).
 * - ESM output has no `require`, so CommonJS dependencies that call `require("fs")`
 *   (for example qrcode's Node build) crash at init with "Dynamic require of fs is not
 *   supported". The banner gives the bundle a real `require`.
 * - Prefer packages' ESM builds (`module`) so fewer CommonJS shims are bundled at all.
 * - The Node runtime ships the AWS SDK v3; never bundle it.
 */
export const LAMBDA_BUNDLING = {
  target: 'node24',
  mainFields: ['module', 'main'],
  banner:
    'import { createRequire as __lambdaCreateRequire } from "node:module"; const require = __lambdaCreateRequire(import.meta.url);',
  externalModules: ['@aws-sdk/*'],
} as const;

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
      entry: lambdaEntry(props.entry),
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: props.memorySize ?? 256,
      timeout: props.timeout ?? Duration.seconds(10),
      logGroup: this.logGroup,
      environment: props.environment ?? {},
      bundling: {
        format: OutputFormat.ESM,
        target: LAMBDA_BUNDLING.target,
        mainFields: [...LAMBDA_BUNDLING.mainFields],
        banner: LAMBDA_BUNDLING.banner,
        minify: true,
        sourceMap: true,
        externalModules: [...LAMBDA_BUNDLING.externalModules],
      },
    });
  }
}
