/**
 * Guards over synthesized CloudFormation, run by the tests:
 * - cost: only pay-per-use services (CLAUDE.md "No always-on compute"), bounded logs,
 *   and secrets in SSM Parameter Store (free) rather than Secrets Manager;
 * - ownership: the club table and Cognito pool belong to the external data stack.
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

/**
 * Resources that belong to the CloudFormation stack built outside this repo
 * (EnvConfig.dataStackName). CDK may reference them but must never define them:
 * a second definition would fork ownership of live data.
 */
export const EXTERNALLY_OWNED_TYPES: readonly string[] = [
  'AWS::DynamoDB::Table',
  'AWS::DynamoDB::GlobalTable',
  'AWS::Cognito::UserPool',
  'AWS::Cognito::UserPoolClient',
  'AWS::Cognito::UserPoolDomain',
];

interface CfnResource {
  readonly Type: string;
  readonly Properties?: Record<string, unknown>;
}

export interface CfnTemplate {
  readonly Resources?: Record<string, CfnResource>;
}

interface PolicyStatement {
  readonly Action?: string | string[];
}

function policyActions(props: Record<string, unknown>): string[] {
  const doc = props.PolicyDocument as { Statement?: PolicyStatement[] } | undefined;
  return (doc?.Statement ?? []).flatMap((st) => [st.Action ?? []].flat());
}

/** Returns one message per cost violation; an empty list means the template is allowed. */
export function findCostViolations(template: CfnTemplate): string[] {
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
    // Owner cost rule: secrets live in SSM Parameter Store (free), never Secrets Manager.
    if (resource.Type.startsWith('AWS::SecretsManager::')) {
      violations.push(`${id}: ${resource.Type} (use SSM Parameter Store SecureString)`);
    }
    if (
      (resource.Type === 'AWS::IAM::Policy' || resource.Type === 'AWS::IAM::ManagedPolicy') &&
      policyActions(props).some((a) => a.startsWith('secretsmanager:'))
    ) {
      violations.push(
        `${id}: grants secretsmanager actions (use SSM Parameter Store SecureString)`,
      );
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

/** Returns one message per externally owned resource the template defines. */
export function findOwnershipViolations(template: CfnTemplate): string[] {
  return Object.entries(template.Resources ?? {})
    .filter(([, r]) => EXTERNALLY_OWNED_TYPES.includes(r.Type))
    .map(([id, r]) => `${id}: ${r.Type} is owned by the external data stack; reference it instead`);
}
