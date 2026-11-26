import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { findCostViolations } from './guards';
import { synthTemplates } from './helpers';

describe('cost guard', () => {
  const templates = synthTemplates({
    appLinks: { appleTeamId: 'ABCDE12345', androidSha256CertFingerprints: ['AA:BB'] },
  });

  it.each(Object.entries(templates))(
    '%s stack has no always-on resources or unbounded logs',
    (_, t) => {
      expect(findCostViolations(t.toJSON())).toEqual([]);
    },
  );

  it('flags always-on compute and unbounded logs (the guard is not vacuous)', () => {
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

    const messages = findCostViolations(Template.fromStack(stack).toJSON()).join('\n');
    expect(messages).toMatch(/AWS::EC2::Instance/);
    expect(messages).toMatch(/AWS::EC2::NatGateway/);
    expect(messages).toMatch(/log group without retention/);
    expect(messages).toMatch(/provisioned concurrency/);
    expect(messages).toMatch(/Lambda without an explicit log group/);
  });
});
