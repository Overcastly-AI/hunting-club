// The club table's key schema: the single source for infra (CDK table definition,
// IAM conditions) and the club API. Starter definitions; the club data layer
// (agent/club-data) builds its item types and access patterns on top of these.

/** Primary key attributes (both strings). */
export const TABLE_KEYS = {
  partitionKey: 'pk',
  sortKey: 'sk',
} as const;

/** Global secondary indexes (projection ALL, string keys). */
export const GSIS = {
  /** Generic inverted / lookup index (e.g. a user's memberships across clubs). */
  gsi1: { indexName: 'gsi1', partitionKey: 'gsi1pk', sortKey: 'gsi1sk' },
} as const;

/** Epoch-seconds attribute DynamoDB TTL uses to delete expired items (invites, guest passes). */
export const TTL_ATTRIBUTE = 'expiresAt';

/**
 * Partition-key prefixes that IAM policies match on. Billing items live in their own
 * partitions so the Stripe webhook can be limited to them with `dynamodb:LeadingKeys`.
 */
export const PARTITION_PREFIXES = {
  subscription: 'SUBSCRIPTION#',
  stripeEvent: 'STRIPE_EVENT#',
} as const;
