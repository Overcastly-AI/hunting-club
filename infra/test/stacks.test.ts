import { Match } from 'aws-cdk-lib/assertions';
import { GSIS, PARTITION_PREFIXES, TABLE_KEYS, TTL_ATTRIBUTE } from '@huntclub/club-data';
import { APP_ID } from '@huntclub/shared';
import {
  API_ENV,
  CLUB_API_SECRETS,
  PROJECT,
  STRIPE_WEBHOOK_SECRETS,
  type SecretKey,
  secretParameterName,
  secretParameterEnvVar,
  userPoolClientIds,
} from '../config';
import { dev } from '../config/dev';
import { CLUB_API_TABLE_ACTIONS } from '../src/stacks/api-stack';
import { synthTemplates } from './helpers';

const templates = synthTemplates();
/** The club table ARN as CDK synthesizes it (partition token, explicit account/region). */
const clubTableArn = (suffix = '') => ({
  'Fn::Join': [
    '',
    [
      'arn:',
      { Ref: 'AWS::Partition' },
      `:dynamodb:${dev.region}:${dev.account}:table/${dev.clubTableName}${suffix}`,
    ],
  ],
});

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

describe('club table keys (@huntclub/club-data)', () => {
  // The live table's key schema is immutable: these strings must never change.
  it('match the live table hunt-club-mesh-dev exactly', () => {
    expect(TABLE_KEYS).toEqual({ partitionKey: 'PK', sortKey: 'SK' });
    expect(GSIS).toEqual({
      gsi1: { indexName: 'GSI1', partitionKey: 'GSI1PK', sortKey: 'GSI1SK' },
    });
    expect(TTL_ATTRIBUTE).toBe('expiresAt');
  });
});

describe('api stack', () => {
  const t = templates.api;

  type Statement = { Action: string | string[]; Resource: unknown; Condition?: unknown };
  /** Policy statements, optionally only those attached to one Lambda's role (by logical id). */
  const statements = (lambda?: 'ClubApi' | 'StripeWebhook') =>
    Object.values(t.findResources('AWS::IAM::Policy'))
      .filter((p) => !lambda || JSON.stringify(p.Properties.Roles).includes(lambda))
      .flatMap((p) => p.Properties.PolicyDocument.Statement as Statement[]);
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

  it('gives the club API the existing table and Cognito pool from config', () => {
    t.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: {
          [API_ENV.envName]: dev.name,
          [API_ENV.tableName]: dev.clubTableName,
          [API_ENV.userPoolId]: dev.cognito.userPoolId,
          [API_ENV.userPoolClientIds]: userPoolClientIds(dev).join(','),
          [API_ENV.webOrigin]: `https://${dev.domainName}`,
          [API_ENV.stripePrices]: JSON.stringify(dev.stripe.prices),
          [secretParameterEnvVar('stripeApiKey')]: secretParameterName(dev.name, 'stripeApiKey'),
        },
      },
    });
  });

  it('accepts the web client once it is configured', () => {
    const withWeb = synthTemplates({
      cognito: { ...dev.cognito, webClientId: 'webclient123' },
    }).api;
    withWeb.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          [API_ENV.userPoolClientIds]: `${dev.cognito.appClientId},webclient123`,
        }),
      },
    });
  });

  it('passes the webhook secret NAMES, never values', () => {
    const variables: Record<string, unknown> = {
      [API_ENV.envName]: dev.name,
      [API_ENV.tableName]: dev.clubTableName,
    };
    for (const key of STRIPE_WEBHOOK_SECRETS) {
      variables[secretParameterEnvVar(key)] = secretParameterName(dev.name, key);
    }
    t.hasResourceProperties('AWS::Lambda::Function', { Environment: { Variables: variables } });
  });

  const SECRETS_BY_LAMBDA: [lambda: 'ClubApi' | 'StripeWebhook', keys: readonly SecretKey[]][] = [
    ['ClubApi', CLUB_API_SECRETS],
    ['StripeWebhook', STRIPE_WEBHOOK_SECRETS],
  ];

  it.each(SECRETS_BY_LAMBDA)(
    'lets %s read exactly its own SSM parameters, no wildcard',
    (lambda, keys) => {
      const ssmStatements = statements(lambda).filter((s) =>
        actionsOf(s).some((a) => a.startsWith('ssm:')),
      );
      expect(ssmStatements).toHaveLength(keys.length);
      for (const s of ssmStatements) {
        expect(actionsOf(s)).toContain('ssm:GetParameter');
        expect(actionsOf(s).every((a) => a.startsWith('ssm:') && !/Put|Delete/.test(a))).toBe(true);
      }
      const resources = JSON.stringify(ssmStatements.map((s) => s.Resource));
      for (const key of keys) {
        expect(resources).toContain(`:parameter${secretParameterName(dev.name, key)}"`);
      }
      expect(resources).not.toContain('parameter/*');
    },
  );

  it('uses no Secrets Manager', () => {
    expect(
      statements().some((s) => actionsOf(s).some((a) => a.startsWith('secretsmanager:'))),
    ).toBe(false);
  });

  it.each(SECRETS_BY_LAMBDA)(
    'lets %s decrypt only through SSM, only its own parameters',
    (lambda, keys) => {
      const kms = statements(lambda).filter((s) => actionsOf(s).includes('kms:Decrypt'));
      expect(kms).toHaveLength(1);
      expect(actionsOf(kms[0]!)).toEqual(['kms:Decrypt']);
      const condition = JSON.stringify(kms[0]!.Condition);
      expect(condition).toContain(`ssm.${dev.region}.amazonaws.com`);
      for (const key of keys) {
        expect(condition).toContain(`parameter${secretParameterName(dev.name, key)}`);
      }
      expect(condition.match(/parameter\//g)).toHaveLength(keys.length);
    },
  );

  it('names parameters /hunt-club-mesh/<env>/<name>', () => {
    expect(secretParameterName('dev', 'stripeWebhookSecret')).toBe(
      '/hunt-club-mesh/dev/stripe-webhook-secret',
    );
  });

  it('limits the webhook to billing partitions of the table', () => {
    const conditioned = statements().filter(
      (s) => s.Condition !== undefined && actionsOf(s).some((a) => a.startsWith('dynamodb:')),
    );
    expect(conditioned).toHaveLength(1);
    expect(conditioned[0]?.Condition).toEqual({
      'ForAllValues:StringLike': {
        'dynamodb:LeadingKeys': Object.values(PARTITION_PREFIXES).map((p) => `${p}*`),
      },
    });
    expect(actionsOf(conditioned[0]!).every((a) => !/Scan|Query|Delete|Batch/.test(a))).toBe(true);
    expect(conditioned[0]!.Resource).toEqual(clubTableArn());
  });

  it('gives the club API item and query access only: no Scan, no streams, no table admin', () => {
    const clubApi = statements().filter(
      (s) => s.Condition === undefined && actionsOf(s).some((a) => a.startsWith('dynamodb:')),
    );
    expect(clubApi).toHaveLength(1);
    expect(actionsOf(clubApi[0]!).sort()).toEqual([...CLUB_API_TABLE_ACTIONS].sort());
    expect(clubApi[0]!.Resource).toEqual([clubTableArn(), clubTableArn('/index/*')]);
  });
});

it('uses the app identity from @huntclub/shared', () => {
  expect(APP_ID).toBe('com.overcastly.huntclub');
});
