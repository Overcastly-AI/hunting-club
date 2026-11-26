/**
 * Cost guard: the project may only use pay-per-use AWS services (CLAUDE.md "No always-on
 * compute"). These rules run over synthesized CloudFormation templates in the tests.
 */

/** Resource types that bill by the hour whether or not anyone uses them. */
export const FORBIDDEN_RESOURCE_TYPES: readonly string[] = [
  'AWS::EC2::Instance',
  'AWS::EC2::NatGateway',
  'AWS::EC2::Host',
  'AWS::AutoScaling::AutoScalingGroup',
  'AWS::ElasticLoadBalancing::LoadBalancer',
  'AWS::ElasticLoadBalancingV2::LoadBalancer',
  'AWS::RDS::DBInstance',
  'AWS::RDS::DBCluster',
  'AWS::DocDB::DBCluster',
  'AWS::Neptune::DBCluster',
  'AWS::Redshift::Cluster',
  'AWS::ECS::Service',
  'AWS::ECS::Cluster',
  'AWS::EKS::Cluster',
  'AWS::AppRunner::Service',
  'AWS::ElastiCache::CacheCluster',
  'AWS::ElastiCache::ReplicationGroup',
  'AWS::ElastiCache::ServerlessCache',
  'AWS::OpenSearchService::Domain',
  'AWS::Elasticsearch::Domain',
  'AWS::MSK::Cluster',
  'AWS::Kinesis::Stream',
  'AWS::SageMaker::Endpoint',
];

interface CfnResource {
  readonly Type: string;
  readonly Properties?: Record<string, unknown>;
}

export interface CfnTemplate {
  readonly Resources?: Record<string, CfnResource>;
}

export interface CostGuardOptions {
  /** DynamoDB point-in-time recovery is billed; only environments that opt in may use it. */
  readonly allowPointInTimeRecovery: boolean;
}

interface PitrSpec {
  readonly PointInTimeRecoveryEnabled?: unknown;
}

const pitrOn = (spec: unknown) =>
  (spec as PitrSpec | undefined)?.PointInTimeRecoveryEnabled === true;

/** Returns one message per violation; an empty list means the template is allowed. */
export function findCostViolations(template: CfnTemplate, options: CostGuardOptions): string[] {
  const violations: string[] = [];
  for (const [id, resource] of Object.entries(template.Resources ?? {})) {
    const props = resource.Properties ?? {};
    if (FORBIDDEN_RESOURCE_TYPES.includes(resource.Type)) {
      violations.push(`${id}: ${resource.Type} is always-on compute`);
    }
    if (
      (resource.Type === 'AWS::Lambda::Version' || resource.Type === 'AWS::Lambda::Alias') &&
      props.ProvisionedConcurrencyConfig !== undefined
    ) {
      violations.push(`${id}: provisioned concurrency is always-on`);
    }
    if (resource.Type === 'AWS::Logs::LogGroup' && props.RetentionInDays === undefined) {
      violations.push(`${id}: log group without retention`);
    }
    if (
      resource.Type === 'AWS::DynamoDB::Table' ||
      resource.Type === 'AWS::DynamoDB::GlobalTable'
    ) {
      if (props.BillingMode !== 'PAY_PER_REQUEST') {
        violations.push(`${id}: DynamoDB table is not on-demand (provisioned capacity)`);
      }
      const replicas = (props.Replicas as { PointInTimeRecoverySpecification?: unknown }[]) ?? [];
      const pitr = [
        props.PointInTimeRecoverySpecification,
        ...replicas.map((r) => r.PointInTimeRecoverySpecification),
      ];
      if (!options.allowPointInTimeRecovery && pitr.some(pitrOn)) {
        violations.push(
          `${id}: DynamoDB point-in-time recovery is not allowed in this environment`,
        );
      }
    }
    // Owner cost rule: secrets live in SSM Parameter Store (free), never Secrets Manager.
    if (resource.Type.startsWith('AWS::SecretsManager::')) {
      violations.push(`${id}: ${resource.Type} (use SSM Parameter Store SecureString)`);
    }
    if (resource.Type === 'AWS::IAM::Policy' || resource.Type === 'AWS::IAM::ManagedPolicy') {
      const statements =
        (props.PolicyDocument as { Statement?: { Action?: string | string[] }[] })?.Statement ?? [];
      if (
        statements.some((st) =>
          [st.Action ?? []].flat().some((a) => a.startsWith('secretsmanager:')),
        )
      ) {
        violations.push(
          `${id}: grants secretsmanager actions (use SSM Parameter Store SecureString)`,
        );
      }
    }
    if (resource.Type === 'AWS::Lambda::Function') {
      const logging = props.LoggingConfig as { LogGroup?: unknown } | undefined;
      if (logging?.LogGroup === undefined) {
        violations.push(`${id}: Lambda without an explicit log group (default never expires)`);
      }
    }
  }
  return violations;
}
