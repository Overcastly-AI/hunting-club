import { Match } from 'aws-cdk-lib/assertions';
import { GSIS, PARTITION_PREFIXES, TABLE_KEYS, TTL_ATTRIBUTE } from '@huntclub/club-data';
import { APP_ID, AUTH_CALLBACK_PATH, URL_SCHEME } from '@huntclub/shared';
import { API_ENV, PROJECT, STRIPE_WEBHOOK_SECRETS, secretName, secretNameEnvVar } from '../config';
import { dev } from '../config/dev';
import { CLUB_API_TABLE_ACTIONS } from '../src/stacks/api-stack';
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
    const projectTags = { Project: PROJECT, Env: dev.name };
    for (const pool of Object.values(t.findResources('AWS::Cognito::UserPool'))) {
      expect(pool.Properties.UserPoolTags).toEqual(expect.objectContaining(projectTags));
    }
    for (const table of Object.values(t.findResources('AWS::DynamoDB::GlobalTable'))) {
      for (const replica of table.Properties.Replicas) {
        expect(replica.Tags).toEqual(
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

describe('data stack', () => {
  const t = templates.data;

  it('is one on-demand table keyed from @huntclub/club-data', () => {
    t.resourceCountIs('AWS::DynamoDB::GlobalTable', 1);
    t.resourceCountIs('AWS::DynamoDB::Table', 0);
    t.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [
        { AttributeName: TABLE_KEYS.partitionKey, KeyType: 'HASH' },
        { AttributeName: TABLE_KEYS.sortKey, KeyType: 'RANGE' },
      ],
      GlobalSecondaryIndexes: Object.values(GSIS).map((gsi) =>
        Match.objectLike({
          IndexName: gsi.indexName,
          KeySchema: [
            { AttributeName: gsi.partitionKey, KeyType: 'HASH' },
            { AttributeName: gsi.sortKey, KeyType: 'RANGE' },
          ],
        }),
      ),
      TimeToLiveSpecification: { AttributeName: TTL_ATTRIBUTE, Enabled: true },
      Replicas: [
        Match.objectLike({
          Region: dev.region,
          DeletionProtectionEnabled: true,
          PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: false },
        }),
      ],
    });
    t.hasResource('AWS::DynamoDB::GlobalTable', { DeletionPolicy: 'Retain' });
  });
});

describe('auth stack', () => {
  const t = templates.auth;

  it('is a passwordless email-code user pool on the Essentials plan', () => {
    t.hasResourceProperties('AWS::Cognito::UserPool', {
      UserPoolTier: 'ESSENTIALS',
      UsernameAttributes: ['email'],
      AutoVerifiedAttributes: ['email'],
      Policies: Match.objectLike({
        SignInPolicy: { AllowedFirstAuthFactors: Match.arrayWith(['EMAIL_OTP']) },
      }),
      DeletionProtection: 'ACTIVE',
      MfaConfiguration: 'OFF',
    });
    t.resourceCountIs('AWS::Cognito::UserPoolDomain', 0);
  });

  it('has public app and web clients with USER_AUTH and the shared callback URLs', () => {
    t.resourceCountIs('AWS::Cognito::UserPoolClient', 2);
    const expected = [
      `${URL_SCHEME}://${AUTH_CALLBACK_PATH}`,
      `https://${dev.domainName}/${AUTH_CALLBACK_PATH}`,
    ];
    for (const url of expected) {
      t.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        GenerateSecret: false,
        ExplicitAuthFlows: Match.arrayWith(['ALLOW_USER_AUTH']),
        PreventUserExistenceErrors: 'ENABLED',
        CallbackURLs: [url],
      });
    }
  });
});

describe('api stack', () => {
  const t = templates.api;

  const statements = () =>
    Object.values(t.findResources('AWS::IAM::Policy')).flatMap(
      (p) =>
        p.Properties.PolicyDocument.Statement as {
          Action: string | string[];
          Resource: unknown;
          Condition?: unknown;
        }[],
    );
  const actionsOf = (s: { Action: string | string[] }) => [s.Action].flat();

  it('exposes both Lambdas through Function URLs, no API Gateway', () => {
    t.resourceCountIs('AWS::Lambda::Url', 2);
    t.hasResourceProperties('AWS::Lambda::Url', {
      AuthType: 'NONE',
      Cors: Match.objectLike({ AllowOrigins: [`https://${dev.domainName}`] }),
    });
    t.resourceCountIs('AWS::ApiGateway::RestApi', 0);
    t.resourceCountIs('AWS::ApiGatewayV2::Api', 0);
  });

  it('gives the club API its table and Cognito configuration', () => {
    t.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          [API_ENV.envName]: dev.name,
          [API_ENV.tableName]: Match.anyValue(),
          [API_ENV.userPoolId]: Match.anyValue(),
          [API_ENV.userPoolClientIds]: Match.anyValue(),
        }),
      },
    });
  });

  it('passes the webhook secret NAMES, never values', () => {
    const variables: Record<string, unknown> = {
      [API_ENV.envName]: dev.name,
      [API_ENV.tableName]: Match.anyValue(),
    };
    for (const key of STRIPE_WEBHOOK_SECRETS) {
      variables[secretNameEnvVar(key)] = secretName(dev.name, key);
    }
    t.hasResourceProperties('AWS::Lambda::Function', { Environment: { Variables: variables } });
  });

  it('lets the webhook read exactly its own secrets', () => {
    const secretStatements = statements().filter((s) =>
      actionsOf(s).some((a) => a.startsWith('secretsmanager:')),
    );
    expect(secretStatements).toHaveLength(STRIPE_WEBHOOK_SECRETS.length);
    const resources = JSON.stringify(secretStatements.map((s) => s.Resource));
    for (const key of STRIPE_WEBHOOK_SECRETS) {
      expect(resources).toContain(`secret:${secretName(dev.name, key)}-??????`);
    }
    expect(resources).not.toContain('secret:*');
  });

  it('limits the webhook to billing partitions of the table', () => {
    const conditioned = statements().filter((s) => s.Condition !== undefined);
    expect(conditioned).toHaveLength(1);
    expect(conditioned[0]?.Condition).toEqual({
      'ForAllValues:StringLike': {
        'dynamodb:LeadingKeys': Object.values(PARTITION_PREFIXES).map((p) => `${p}*`),
      },
    });
    expect(actionsOf(conditioned[0]!).every((a) => !/Scan|Query|Delete|Batch/.test(a))).toBe(true);
  });

  it('gives the club API item and query access only: no Scan, no streams, no table admin', () => {
    const clubApi = statements().filter(
      (s) => s.Condition === undefined && actionsOf(s).some((a) => a.startsWith('dynamodb:')),
    );
    expect(clubApi).toHaveLength(1);
    expect(actionsOf(clubApi[0]!).sort()).toEqual([...CLUB_API_TABLE_ACTIONS].sort());
    expect(JSON.stringify(clubApi[0]!.Resource)).toContain('/index/*');
  });
});

it('uses the app identity from @huntclub/shared', () => {
  expect(APP_ID).toBe('com.overcastly.huntclub');
});
