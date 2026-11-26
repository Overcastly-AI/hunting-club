import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';
import { BILLING_MODE, GSIS, TABLE_KEYS } from './keys';

/**
 * CreateTable input derived from the table definition in keys.ts (the same data the
 * CDK stack uses). Used for DynamoDB Local in tests and local development.
 */
export function createTableInput(tableName: string): CreateTableCommandInput {
  const keyAttributes = [TABLE_KEYS, ...GSIS].flatMap((k) => [k.partitionKey, k.sortKey]);
  return {
    TableName: tableName,
    BillingMode: BILLING_MODE,
    AttributeDefinitions: keyAttributes.map((a) => ({
      AttributeName: a.name,
      AttributeType: a.type,
    })),
    KeySchema: [
      { AttributeName: TABLE_KEYS.partitionKey.name, KeyType: 'HASH' },
      { AttributeName: TABLE_KEYS.sortKey.name, KeyType: 'RANGE' },
    ],
    GlobalSecondaryIndexes: GSIS.map((g) => ({
      IndexName: g.indexName,
      KeySchema: [
        { AttributeName: g.partitionKey.name, KeyType: 'HASH' },
        { AttributeName: g.sortKey.name, KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: g.projection },
    })),
  };
}
