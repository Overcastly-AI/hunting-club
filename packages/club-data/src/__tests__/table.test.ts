import { createTableInput } from '../localTable';
import { GSIS, PARTITION_PREFIXES, TABLE_KEYS, TTL_ATTRIBUTE } from '../table';
import { keys } from '../items';

describe('table definition', () => {
  it('derives the local CreateTable input from table.ts (the definition infra references)', () => {
    const input = createTableInput('t');
    expect(input.KeySchema).toEqual([
      { AttributeName: TABLE_KEYS.partitionKey, KeyType: 'HASH' },
      { AttributeName: TABLE_KEYS.sortKey, KeyType: 'RANGE' },
    ]);
    expect(input.GlobalSecondaryIndexes?.map((g) => g.IndexName)).toEqual(
      Object.values(GSIS).map((g) => g.indexName),
    );
    expect(input.AttributeDefinitions?.map((a) => a.AttributeName)).toEqual([
      'PK',
      'SK',
      'GSI1PK',
      'GSI1SK',
    ]);
  });

  it('matches the live table hunt-club-mesh-dev (names are immutable there)', () => {
    expect(TABLE_KEYS).toEqual({ partitionKey: 'PK', sortKey: 'SK' });
    expect(GSIS).toEqual({
      gsi1: { indexName: 'GSI1', partitionKey: 'GSI1PK', sortKey: 'GSI1SK' },
    });
    expect(TTL_ATTRIBUTE).toBe('expiresAt');
  });

  it('puts every item the Stripe webhook writes in a billing partition (its IAM LeadingKeys)', () => {
    const prefixes = Object.values(PARTITION_PREFIXES);
    const webhookKeys = [
      keys.subscription('00000000-0000-4000-8000-000000000001'),
      keys.stripeEvent('evt_1'),
      keys.stripeSubscription('sub_1'),
    ];
    for (const key of webhookKeys) {
      expect(prefixes.some((p) => key.PK!.startsWith(p))).toBe(true);
    }
  });
});
