import { Match } from 'aws-cdk-lib/assertions';
import { APP_ID } from '@huntclub/shared';
import { PROJECT, STRIPE_WEBHOOK_SECRETS, secretName, secretNameEnvVar } from '../config';
import { dev } from '../config/dev';
import { synthTemplates } from './helpers';

const templates = synthTemplates();

describe('every stack', () => {
  it.each(Object.entries(templates))(
    '%s: Lambdas are Node 24 on arm64 with 14-day logs',
    (_, t) => {
      for (const fn of Object.values(t.findResources('AWS::Lambda::Function'))) {
        expect(fn.Properties.Runtime).toBe('nodejs24.x');
        expect(fn.Properties.Architectures).toEqual(['arm64']);
      }
      for (const group of Object.values(t.findResources('AWS::Logs::LogGroup'))) {
        expect(group.Properties.RetentionInDays).toBe(14);
      }
    },
  );

  it.each(Object.entries(templates))('%s: taggable resources carry Project and Env', (_, t) => {
    const taggable = [
      'AWS::S3::Bucket',
      'AWS::CloudFront::Distribution',
      'AWS::Lambda::Function',
      'AWS::Logs::LogGroup',
      'AWS::IAM::Role',
    ];
    for (const type of taggable) {
      for (const resource of Object.values(t.findResources(type))) {
        expect(resource.Properties.Tags).toEqual(
          expect.arrayContaining([
            { Key: 'Project', Value: PROJECT },
            { Key: 'Env', Value: dev.name },
          ]),
        );
      }
    }
  });
});

describe('web stack', () => {
  const t = templates.web;

  it('keeps the bucket private and TLS-only', () => {
    t.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
    t.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Deny',
            Condition: { Bool: { 'aws:SecureTransport': 'false' } },
          }),
        ]),
      },
    });
  });

  it('serves the domain over HTTPS with the existing certificate and origin access control', () => {
    t.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
    t.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        Aliases: [dev.domainName],
        ViewerCertificate: Match.objectLike({
          AcmCertificateArn: dev.certificateArn,
          MinimumProtocolVersion: 'TLSv1.2_2021',
        }),
        DefaultCacheBehavior: Match.objectLike({ ViewerProtocolPolicy: 'redirect-to-https' }),
        PriceClass: 'PriceClass_100',
      }),
    });
  });

  it('points A and AAAA alias records in the dev zone at CloudFront', () => {
    for (const type of ['A', 'AAAA']) {
      t.hasResourceProperties('AWS::Route53::RecordSet', {
        HostedZoneId: dev.hostedZoneId,
        Name: `${dev.domainName}.`,
        Type: type,
        AliasTarget: Match.objectLike({ HostedZoneId: Match.anyValue() }),
      });
    }
  });

  it('publishes no universal-link files until the app IDs are known', () => {
    t.resourceCountIs('Custom::CDKBucketDeployment', 0);
  });

  it('publishes .well-known files as JSON once the team ID and fingerprints are set', () => {
    const withLinks = synthTemplates({
      appLinks: { appleTeamId: 'ABCDE12345', androidSha256CertFingerprints: ['AA:BB'] },
    }).web;
    withLinks.hasResourceProperties('Custom::CDKBucketDeployment', {
      SystemMetadata: Match.objectLike({ 'content-type': 'application/json' }),
      Prune: false,
      DistributionPaths: ['/.well-known/*'],
    });
  });
});

describe('api stack', () => {
  const t = templates.api;

  it('exposes the Stripe webhook through a public Function URL (Stripe signs, not SigV4)', () => {
    t.hasResourceProperties('AWS::Lambda::Url', { AuthType: 'NONE' });
    t.resourceCountIs('AWS::ApiGateway::RestApi', 0);
    t.resourceCountIs('AWS::ApiGatewayV2::Api', 0);
  });

  it('passes secret NAMES, never values, in the environment', () => {
    const variables: Record<string, string> = { ENV_NAME: dev.name };
    for (const key of STRIPE_WEBHOOK_SECRETS)
      variables[secretNameEnvVar(key)] = secretName(dev.name, key);
    t.hasResourceProperties('AWS::Lambda::Function', { Environment: { Variables: variables } });
    expect(variables.STRIPE_WEBHOOK_SECRET_NAME).toBe('hunt-club-mesh/dev/stripe-webhook-secret');
  });

  it('can read exactly its own secrets and nothing else', () => {
    const policies = Object.values(t.findResources('AWS::IAM::Policy'));
    const statements = policies.flatMap(
      (p) =>
        p.Properties.PolicyDocument.Statement as { Action: string | string[]; Resource: unknown }[],
    );
    const secretStatements = statements.filter((s) =>
      [s.Action].flat().some((a) => a.startsWith('secretsmanager:')),
    );
    expect(secretStatements).toHaveLength(STRIPE_WEBHOOK_SECRETS.length);
    for (const s of secretStatements) {
      expect([s.Action].flat().sort()).toEqual([
        'secretsmanager:DescribeSecret',
        'secretsmanager:GetSecretValue',
      ]);
    }
    const resources = JSON.stringify(secretStatements.map((s) => s.Resource));
    for (const key of STRIPE_WEBHOOK_SECRETS) {
      expect(resources).toContain(`secret:${secretName(dev.name, key)}-??????`);
    }
    expect(resources).not.toContain('secret:*');
  });
});

describe('ops stack', () => {
  const t = templates.ops;

  it('runs the keep-alive Lambda daily on EventBridge Scheduler', () => {
    t.hasResourceProperties('AWS::Scheduler::Schedule', {
      ScheduleExpression: dev.keepAliveSchedule,
      State: 'ENABLED',
      Target: Match.objectLike({ RetryPolicy: Match.objectLike({ MaximumRetryAttempts: 2 }) }),
    });
    t.resourceCountIs('AWS::Lambda::Function', 1);
  });
});

it('uses the app identity from @huntclub/shared', () => {
  expect(APP_ID).toBe('com.overcastly.huntclub');
});
