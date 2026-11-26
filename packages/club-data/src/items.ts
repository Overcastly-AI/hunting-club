/**
 * Single-table item layout: how every entity is keyed. The README's access-pattern
 * table documents the same layout; change both together.
 */
import { GSIS, PARTITION_PREFIXES, TABLE_KEYS, TTL_ATTRIBUTE } from './table';

export type Key = Record<string, string>;

const PK = TABLE_KEYS.partitionKey;
const SK = TABLE_KEYS.sortKey;
const GPK = GSIS.gsi1.partitionKey;
const GSK = GSIS.gsi1.sortKey;
/** The one secondary index (overloaded). */
export const GSI1 = GSIS.gsi1.indexName;

const key = (pk: string, sk: string): Key => ({ [PK]: pk, [SK]: sk });
const gsi1 = (pk: string, sk: string): Key => ({ [GPK]: pk, [GSK]: sk });

const clubPk = (clubId: string) => `CLUB#${clubId}`;

/** Sort-key prefixes of the item collections inside a club partition. */
export const CLUB_COLLECTIONS = {
  member: 'MEMBER#',
  area: 'AREA#',
  stand: 'STAND#',
  harvest: 'HARVEST#',
  mapPack: 'MAPPACK#',
} as const;
export type ClubCollection = keyof typeof CLUB_COLLECTIONS;

/** Mesh-id counters: one per club and kind of place. */
export type PlaceKind = 'area' | 'stand';

export const keys = {
  clubPartition: (clubId: string) => ({ [PK]: clubPk(clubId) }),
  club: (clubId: string) => key(clubPk(clubId), 'CLUB'),
  secret: (clubId: string) => key(clubPk(clubId), 'SECRET'),
  // Billing items live in their own partitions (PARTITION_PREFIXES) so the Stripe
  // webhook's IAM policy can be limited to them with dynamodb:LeadingKeys.
  subscription: (clubId: string) =>
    key(`${PARTITION_PREFIXES.subscription}${clubId}`, 'SUBSCRIPTION'),
  meshCounter: (clubId: string, kind: PlaceKind) =>
    key(clubPk(clubId), `MESHID#${kind.toUpperCase()}`),
  inClub: (clubId: string, collection: ClubCollection, id: string) =>
    key(clubPk(clubId), `${CLUB_COLLECTIONS[collection]}${id}`),
  invite: (token: string) => key(`INVITE#${token}`, 'INVITE'),
  plan: (planId: string) => key(`PLAN#${planId}`, 'PLAN'),
  stripeEvent: (eventId: string) =>
    key(`${PARTITION_PREFIXES.stripeEvent}${eventId}`, 'STRIPE_EVENT'),
  /**
   * Uniqueness guard: a Stripe subscription belongs to exactly one club. In the
   * subscription prefix (Stripe ids start with `sub_`, club ids are UUIDs, so the
   * two never collide) so the webhook may write it.
   */
  stripeSubscription: (subscriptionId: string) =>
    key(`${PARTITION_PREFIXES.subscription}${subscriptionId}`, 'STRIPE_SUBSCRIPTION'),
};

/** GSI1 entries (overloaded index). */
export const gsi1Keys = {
  /** A user's memberships across clubs ("my clubs"). */
  memberOfUser: (userId: string, clubId: string) => gsi1(`USER#${userId}`, clubPk(clubId)),
  userPartition: (userId: string) => `USER#${userId}`,
  /** A club's invites (admin list, revoke by id). */
  clubInvite: (clubId: string, inviteId: string) =>
    gsi1(clubInvitesPartition(clubId), `INVITE#${inviteId}`),
  clubInvitesPartition: (clubId: string) => clubInvitesPartition(clubId),
  plan: (planId: string) => gsi1(PLANS_PARTITION, `PLAN#${planId}`),
  plansPartition: () => PLANS_PARTITION,
};
const PLANS_PARTITION = 'PLANS';
function clubInvitesPartition(clubId: string) {
  return `${clubPk(clubId)}#INVITES`;
}

export const ATTR = { PK, SK, GPK, GSK } as const;

/**
 * Expiry (guest passes, invites): entities carry `expiresAt` as an ISO timestamp; items
 * store it only in the TTL attribute, as epoch seconds (what DynamoDB TTL deletes on).
 * Conditions compare that attribute with `epochSeconds(now)`.
 */
export const epochSeconds = (isoOrDate: string | Date) =>
  Math.ceil(new Date(isoOrDate).getTime() / 1000);

/** Entity → item attributes: drops `expiresAt`, adds the TTL attribute when set. */
export function withExpiry<T extends { expiresAt?: string | undefined }>(entity: T) {
  const { expiresAt, ...rest } = entity;
  return { ...rest, ...(expiresAt ? { [TTL_ATTRIBUTE]: epochSeconds(expiresAt) } : {}) };
}

/** Item → entity attributes: the TTL attribute back to an ISO `expiresAt`. */
export function readExpiry(item: Record<string, unknown>): Record<string, unknown> {
  const ttl = item[TTL_ATTRIBUTE];
  if (typeof ttl !== 'number') return item;
  const { [TTL_ATTRIBUTE]: _ttl, ...rest } = item;
  return { ...rest, expiresAt: new Date(ttl * 1000).toISOString() };
}

/** Condition fragment: the item has no expiry or it is still in the future. */
export const notExpired = (now: Date) => ({
  condition: '(attribute_not_exists(#exp) OR #exp > :nowSec)',
  names: { '#exp': TTL_ATTRIBUTE },
  values: { ':nowSec': Math.floor(now.getTime() / 1000) },
});
