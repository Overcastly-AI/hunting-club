/**
 * Single-table item layout: how every entity is keyed. The README's access-pattern
 * table documents the same layout; change both together.
 */
import { GSI1, TABLE_KEYS, TTL_ATTRIBUTE } from './keys';

export type Key = Record<string, string>;

const PK = TABLE_KEYS.partitionKey.name;
const SK = TABLE_KEYS.sortKey.name;
const GPK = GSI1.partitionKey.name;
const GSK = GSI1.sortKey.name;

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
  subscription: (clubId: string) => key(clubPk(clubId), 'SUBSCRIPTION'),
  meshCounter: (clubId: string, kind: PlaceKind) =>
    key(clubPk(clubId), `MESHID#${kind.toUpperCase()}`),
  inClub: (clubId: string, collection: ClubCollection, id: string) =>
    key(clubPk(clubId), `${CLUB_COLLECTIONS[collection]}${id}`),
  invite: (token: string) => key(`INVITE#${token}`, 'INVITE'),
  plan: (planId: string) => key(`PLAN#${planId}`, 'PLAN'),
  stripeEvent: (eventId: string) => key(`STRIPEEVENT#${eventId}`, 'STRIPEEVENT'),
  /** Uniqueness guard: a Stripe subscription belongs to exactly one club. */
  stripeSubscription: (subscriptionId: string) => key(`STRIPESUB#${subscriptionId}`, 'STRIPESUB'),
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

export const ATTR = { PK, SK, GPK, GSK, TTL: TTL_ATTRIBUTE } as const;

/** Epoch seconds for the TTL attribute. */
export const ttlFor = (isoTimestamp: string) => Math.ceil(Date.parse(isoTimestamp) / 1000);
