/**
 * The club-data DynamoDB table definition, as plain data.
 *
 * This is the single source of truth for the table's key schema, secondary
 * indexes and TTL attribute. The CDK stack in infra/ imports it to declare the
 * table, and the tests import it (through `createTableInput`) to create the same
 * table in DynamoDB Local. It has no imports so infra can load it without the
 * AWS SDK.
 *
 * Attribute types use DynamoDB's own codes ('S' = string), which are also the
 * values of CDK's `AttributeType` enum.
 */

export interface KeyAttribute {
  readonly name: string;
  readonly type: 'S';
}

export interface GlobalSecondaryIndex {
  readonly indexName: string;
  readonly partitionKey: KeyAttribute;
  readonly sortKey: KeyAttribute;
  /** Every index projects all attributes. */
  readonly projection: 'ALL';
}

/** Primary key: every item is addressed by PK (partition) + SK (sort). */
export const TABLE_KEYS = {
  partitionKey: { name: 'PK', type: 'S' },
  sortKey: { name: 'SK', type: 'S' },
} as const satisfies { partitionKey: KeyAttribute; sortKey: KeyAttribute };

/**
 * GSI1 is the only secondary index (overloaded). See packages/club-data/README.md
 * for the access patterns it serves.
 */
export const GSI1 = {
  indexName: 'GSI1',
  partitionKey: { name: 'GSI1PK', type: 'S' },
  sortKey: { name: 'GSI1SK', type: 'S' },
  projection: 'ALL',
} as const satisfies GlobalSecondaryIndex;

export const GSIS = [GSI1] as const satisfies readonly GlobalSecondaryIndex[];

/**
 * Number attribute (epoch seconds) that DynamoDB TTL deletes on. Set on guest
 * memberships and invites. TTL deletion is lazy (can lag by days), so the
 * repository always checks expiry itself and never relies on the item being gone.
 */
export const TTL_ATTRIBUTE = 'ttl';

/** On-demand capacity: no provisioned throughput, pay per request. */
export const BILLING_MODE = 'PAY_PER_REQUEST';
