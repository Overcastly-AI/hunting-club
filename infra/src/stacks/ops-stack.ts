import { Stack, type StackProps } from 'aws-cdk-lib';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as schedulerTargets from 'aws-cdk-lib/aws-scheduler-targets';
import type { Construct } from 'constructs';
import type { EnvConfig } from '../../config';
import { NodeLambda } from '../constructs/node-lambda';

export interface OpsStackProps extends StackProps {
  readonly config: EnvConfig;
}

/**
 * Scheduled jobs (EventBridge Scheduler, pay-per-invocation). Today: the daily Supabase
 * keep-alive that stops the free project pausing after a week without activity.
 */
export class OpsStack extends Stack {
  readonly keepAlive: NodeLambda;

  constructor(scope: Construct, id: string, props: OpsStackProps) {
    super(scope, id, props);
    const { config } = props;

    this.keepAlive = new NodeLambda(this, 'SupabaseKeepAlive', {
      entry: 'keep-alive',
      environment: {
        ENV_NAME: config.name,
        // Empty until the Supabase project exists; the handler then just logs and exits.
        SUPABASE_URL: config.supabaseUrl ?? '',
      },
    });

    new scheduler.Schedule(this, 'DailyKeepAlive', {
      description: 'Daily Supabase keep-alive (free projects pause after 1 week idle)',
      schedule: scheduler.ScheduleExpression.expression(config.keepAliveSchedule),
      target: new schedulerTargets.LambdaInvoke(this.keepAlive.function, {
        retryAttempts: 2,
      }),
    });
  }
}
