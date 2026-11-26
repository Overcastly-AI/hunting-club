import { RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import type { Construct } from 'constructs';
import { GSIS, TABLE_KEYS, TTL_ATTRIBUTE } from '@huntclub/club-data';
import type { EnvConfig } from '../../config';

export interface DataStackProps extends StackProps {
  readonly config: EnvConfig;
}

const stringKey = (name: string) => ({ name, type: dynamodb.AttributeType.STRING });

/**
 * The club database: ONE DynamoDB table, on-demand (pay per request, $0 idle).
 * Key names and indexes come from @huntclub/club-data; never retype them here.
 */
export class DataStack extends Stack {
  readonly table: dynamodb.TableV2;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    this.table = new dynamodb.TableV2(this, 'ClubTable', {
      partitionKey: stringKey(TABLE_KEYS.partitionKey),
      sortKey: stringKey(TABLE_KEYS.sortKey),
      billing: dynamodb.Billing.onDemand(),
      globalSecondaryIndexes: Object.values(GSIS).map((gsi) => ({
        indexName: gsi.indexName,
        partitionKey: stringKey(gsi.partitionKey),
        sortKey: stringKey(gsi.sortKey),
      })),
      // Invites and guest passes carry an expiry; DynamoDB deletes them for free.
      timeToLiveAttribute: TTL_ATTRIBUTE,
      deletionProtection: true,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: props.config.pointInTimeRecovery,
      },
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }
}
