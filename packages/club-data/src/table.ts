// The club table's key schema: the single source for infra (IAM, Lambda env) and the
// club API. The live table `hunt-club-mesh-dev` is owned by the CloudFormation stack
// HuntClubMeshDataDev (built outside this repo); key names are immutable there, so these
// strings must match it exactly. The club data layer builds its item types on these.

/** Primary key attributes (both strings). */
export const TABLE_KEYS = {
  partitionKey: 'PK',
  sortKey: 'SK',
} as const;

/** Global secondary indexes (projection ALL, string keys). */
export const GSIS = {
  /** Generic inverted / lookup index (e.g. a user's memberships across clubs). */
  gsi1: { indexName: 'GSI1', partitionKey: 'GSI1PK', sortKey: 'GSI1SK' },
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
