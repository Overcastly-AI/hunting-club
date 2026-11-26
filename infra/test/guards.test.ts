import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { dev } from '../config/dev';
import { findCostViolations } from './guards';
import { synthTemplates } from './helpers';

const devGuard = { allowPointInTimeRecovery: dev.pointInTimeRecovery };

describe('cost guard', () => {
  const templates = synthTemplates({
    appLinks: { appleTeamId: 'ABCDE12345', androidSha256CertFingerprints: ['AA:BB'] },
  });

  it.each(Object.entries(templates))(
    '%s stack has no always-on resources, unbounded logs or paid table options',
    (_, t) => {
      expect(findCostViolations(t.toJSON(), devGuard)).toEqual([]);
    },
  );

  it('fails a dev synth that turns on point-in-time recovery', () => {
    const t = synthTemplates({ pointInTimeRecovery: true }).data;
    expect(findCostViolations(t.toJSON(), devGuard).join('\n')).toMatch(/point-in-time recovery/);
  });

  it('flags always-on compute, unbounded logs and provisioned tables (the guard is not vacuous)', () => {
    const stack = new Stack(new App(), 'Bad');
    const vpc = new ec2.Vpc(stack, 'Vpc', { natGateways: 1, maxAzs: 1 });
    new ec2.Instance(stack, 'Box', {
      vpc,
      instanceType: new ec2.InstanceType('t4g.nano'),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.ARM_64,
      }),
    });
    new logs.LogGroup(stack, 'Forever', { retention: logs.RetentionDays.INFINITE });
    const fn = new lambda.Function(stack, 'Fn', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => {}'),
    });
    new lambda.Alias(stack, 'Warm', {
      aliasName: 'live',
      version: fn.currentVersion,
      provisionedConcurrentExecutions: 1,
    });
    new dynamodb.Table(stack, 'Provisioned', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    const messages = findCostViolations(Template.fromStack(stack).toJSON(), devGuard).join('\n');
    expect(messages).toMatch(/AWS::EC2::Instance/);
    expect(messages).toMatch(/AWS::EC2::NatGateway/);
    expect(messages).toMatch(/log group without retention/);
    expect(messages).toMatch(/provisioned concurrency/);
    expect(messages).toMatch(/Lambda without an explicit log group/);
    expect(messages).toMatch(/not on-demand/);
    expect(messages).toMatch(/point-in-time recovery/);
  });
});
