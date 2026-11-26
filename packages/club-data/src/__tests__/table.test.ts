import { createTableInput } from '../table';
import { BILLING_MODE, GSI1, GSIS, TABLE_KEYS, TTL_ATTRIBUTE } from '../keys';

describe('table definition', () => {
  it('derives CreateTable input from keys.ts (the definition the CDK stack imports)', () => {
    const input = createTableInput('t');
    expect(input.BillingMode).toBe(BILLING_MODE);
    expect(input.KeySchema).toEqual([
      { AttributeName: TABLE_KEYS.partitionKey.name, KeyType: 'HASH' },
      { AttributeName: TABLE_KEYS.sortKey.name, KeyType: 'RANGE' },
    ]);
    expect(input.GlobalSecondaryIndexes?.map((g) => g.IndexName)).toEqual(
      GSIS.map((g) => g.indexName),
    );
    expect(input.AttributeDefinitions?.map((a) => a.AttributeName)).toEqual([
      'PK',
      'SK',
      GSI1.partitionKey.name,
      GSI1.sortKey.name,
    ]);
  });

  it('pins the stored layout (renaming a key or index means migrating data)', () => {
    expect(TABLE_KEYS).toEqual({
      partitionKey: { name: 'PK', type: 'S' },
      sortKey: { name: 'SK', type: 'S' },
    });
    expect(GSIS).toEqual([
      {
        indexName: 'GSI1',
        partitionKey: { name: 'GSI1PK', type: 'S' },
        sortKey: { name: 'GSI1SK', type: 'S' },
        projection: 'ALL',
      },
    ]);
    expect(TTL_ATTRIBUTE).toBe('ttl');
  });
});
