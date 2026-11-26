import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { findCostViolations, findOwnershipViolations } from './guards';
import { synthTemplates } from './helpers';

const templates = synthTemplates({
  appLinks: { appleTeamId: 'ABCDE12345', androidSha256CertFingerprints: ['AA:BB'] },
});

describe('cost guard', () => {
  it.each(Object.entries(templates))(
    '%s stack has no always-on resources, unbounded logs or Secrets Manager',
    (_, t) => {
      expect(findCostViolations(t.toJSON())).toEqual([]);
    },
  );

  it('flags always-on compute, unbounded logs and Secrets Manager (not vacuous)', () => {
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
    new secretsmanager.Secret(stack, 'Paid');
    secretsmanager.Secret.fromSecretNameV2(stack, 'Existing', 'x').grantRead(fn);

    const messages = findCostViolations(Template.fromStack(stack).toJSON()).join('\n');
    expect(messages).toMatch(/AWS::EC2::Instance/);
    expect(messages).toMatch(/AWS::EC2::NatGateway/);
    expect(messages).toMatch(/log group without retention/);
    expect(messages).toMatch(/provisioned concurrency/);
    expect(messages).toMatch(/Lambda without an explicit log group/);
    expect(messages).toMatch(/AWS::SecretsManager::Secret/);
    expect(messages).toMatch(/grants secretsmanager actions/);
  });
});

describe('ownership guard (table and user pool live in the external data stack)', () => {
  it.each(Object.entries(templates))('%s stack defines no table, user pool or client', (_, t) => {
    expect(findOwnershipViolations(t.toJSON())).toEqual([]);
  });

  it('flags a stack that defines them (not vacuous)', () => {
    const stack = new Stack(new App(), 'Bad');
    new dynamodb.Table(stack, 'T1', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
    });
    new dynamodb.TableV2(stack, 'T2', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
    });
    new cognito.UserPool(stack, 'Pool').addClient('Client');

    const messages = findOwnershipViolations(Template.fromStack(stack).toJSON()).join('\n');
    expect(messages).toMatch(/AWS::DynamoDB::Table /);
    expect(messages).toMatch(/AWS::DynamoDB::GlobalTable/);
    expect(messages).toMatch(/AWS::Cognito::UserPool /);
    expect(messages).toMatch(/AWS::Cognito::UserPoolClient/);
  });
});
