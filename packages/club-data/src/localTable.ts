import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';
import { GSI_PROJECTION, GSIS, KEY_ATTRIBUTE_TYPE, TABLE_KEYS } from './table';

/**
 * CreateTable input for a local copy of the live table, derived from table.ts (the
 * definition infra references). Used for DynamoDB Local in tests and development;
 * the real table is owned outside this repo.
 */
export function createTableInput(tableName: string): CreateTableCommandInput {
  const indexes = Object.values(GSIS);
  const attributes = [TABLE_KEYS, ...indexes].flatMap((k) => [k.partitionKey, k.sortKey]);
  return {
    TableName: tableName,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: attributes.map((name) => ({
      AttributeName: name,
      AttributeType: KEY_ATTRIBUTE_TYPE,
    })),
    KeySchema: [
      { AttributeName: TABLE_KEYS.partitionKey, KeyType: 'HASH' },
      { AttributeName: TABLE_KEYS.sortKey, KeyType: 'RANGE' },
    ],
    GlobalSecondaryIndexes: indexes.map((g) => ({
      IndexName: g.indexName,
      KeySchema: [
        { AttributeName: g.partitionKey, KeyType: 'HASH' },
        { AttributeName: g.sortKey, KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: GSI_PROJECTION },
    })),
  };
}
