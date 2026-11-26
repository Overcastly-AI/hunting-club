import {
  type Club,
  ClubCreateSchema,
  ClubSchema,
  type ClubSecret,
  ClubSecretSchema,
  ClubUpdateSchema,
  type Member,
  MemberJoinSchema,
  MemberSchema,
  userIdSchema,
} from '@huntclub/shared';
import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import type { Actor } from '../actor';
import { isActiveMembership, requireUser } from '../authz';
import {
  ConditionFailed,
  type Ctx,
  EXISTS,
  get,
  NOT_EXISTS,
  queryAll,
  setFields,
  transact,
  TransactionFailed,
  update,
} from '../db';
import { ATTR, gsi1Keys, keys, type Key } from '../items';
import { authorizeClub, authorizeService, fromItem, getEntity, notFound, validate } from './common';
import { memberItem } from './members';
import { SEAT_ATTRS, initialSeats } from './seats';

/** The provisioning Lambda's input: the club plus its first admin. */
export const ClubProvisionSchema = z.strictObject({
  club: ClubCreateSchema,
  admin: MemberJoinSchema.extend({ userId: userIdSchema }),
});
export type ClubProvision = z.input<typeof ClubProvisionSchema>;

/** Service only: creates the club item and its first admin together. */
export async function createClub(ctx: Ctx, actor: Actor, input: ClubProvision): Promise<Club> {
  authorizeService(actor, 'createClub');
  const { club: fields, admin } = validate(ClubProvisionSchema, input);
  const now = ctx.nowIso();
  const club: Club = {
    id: ctx.newId(),
    ...fields,
    createdBy: admin.userId,
    createdAt: now,
    updatedAt: now,
  };
  const member: Member = {
    clubId: club.id,
    userId: admin.userId,
    displayName: admin.displayName,
    initials: admin.initials,
    role: 'admin',
    createdAt: now,
    updatedAt: now,
  };
  const seats = initialSeats('admin');
  await transact(ctx, [
    {
      put: {
        ...keys.club(club.id),
        ...club,
        [SEAT_ATTRS.seats]: seats.seats,
        [SEAT_ATTRS.admins]: seats.admins,
      },
      condition: NOT_EXISTS,
    },
    { put: memberItem(member), condition: NOT_EXISTS },
  ]);
  return club;
}

export async function getClub(ctx: Ctx, actor: Actor, clubId: string): Promise<Club> {
  await authorizeClub(ctx, actor, clubId, 'readClub');
  const club = await getEntity(ctx, ClubSchema, keys.club(clubId));
  if (!club) throw notFound();
  return club;
}

/** The caller's active memberships with their clubs. */
export async function listMyClubs(
  ctx: Ctx,
  actor: Actor,
): Promise<{ club: Club; membership: Member }[]> {
  const userId = requireUser(actor);
  const items = await queryAll(ctx, {
    IndexName: 'GSI1',
    KeyConditionExpression: '#pk = :pk',
    ExpressionAttributeNames: { '#pk': ATTR.GPK },
    ExpressionAttributeValues: { ':pk': gsi1Keys.userPartition(userId) },
  });
  const now = ctx.now();
  const memberships = items
    .map((i) => fromItem(MemberSchema, i))
    .filter((m) => isActiveMembership(m, now));
  const clubs = await Promise.all(
    memberships.map(async (membership) => {
      const club = await getEntity(ctx, ClubSchema, keys.club(membership.clubId));
      return club && { club, membership };
    }),
  );
  return clubs.filter((c) => c !== undefined);
}

export async function updateClub(
  ctx: Ctx,
  actor: Actor,
  clubId: string,
  patch: z.input<typeof ClubUpdateSchema>,
): Promise<Club> {
  await authorizeClub(ctx, actor, clubId, 'updateClub');
  const fields = validate(ClubUpdateSchema, patch);
  const set = setFields(fields, ctx.nowIso());
  try {
    return fromItem(
      ClubSchema,
      await update(ctx, keys.club(clubId), set.expression, { ...set, condition: EXISTS }),
    );
  } catch (e) {
    if (e instanceof ConditionFailed) throw notFound();
    throw e;
  }
}

/** Service only: deletes the club and everything it owns (members, places, invites, …). */
export async function deleteClub(ctx: Ctx, actor: Actor, clubId: string): Promise<void> {
  authorizeService(actor, 'deleteClub');
  const owned = await queryAll(ctx, {
    KeyConditionExpression: '#pk = :pk',
    ExpressionAttributeNames: { '#pk': ATTR.PK },
    ExpressionAttributeValues: { ':pk': keys.clubPartition(clubId)[ATTR.PK] },
  });
  if (!owned.some((i) => i[ATTR.SK] === keys.club(clubId)[ATTR.SK])) throw notFound();
  const invites = await queryAll(ctx, {
    IndexName: 'GSI1',
    KeyConditionExpression: '#pk = :pk',
    ExpressionAttributeNames: { '#pk': ATTR.GPK },
    ExpressionAttributeValues: { ':pk': gsi1Keys.clubInvitesPartition(clubId) },
  });
  const subscription = owned.find((i) => i[ATTR.SK] === keys.subscription(clubId)[ATTR.SK]);
  const guards = subscription
    ? [keys.stripeSubscription(String(subscription.stripeSubscriptionId))]
    : [];
  const all: Key[] = [...owned, ...invites]
    .map((i): Key => ({ [ATTR.PK]: String(i[ATTR.PK]), [ATTR.SK]: String(i[ATTR.SK]) }))
    .concat(guards);
  await batchDelete(ctx, all);
}

/**
 * Bulk delete for a whole club (BatchWriteItem has no conditions; the club's
 * existence is checked above and nothing else may write a deleted club's items).
 */
async function batchDelete(ctx: Ctx, all: Key[]) {
  for (let i = 0; i < all.length; i += 25) {
    let pending: Record<string, unknown>[] = all
      .slice(i, i + 25)
      .map((Key) => ({ DeleteRequest: { Key } }));
    for (let attempt = 0; pending.length > 0; attempt++) {
      const out = await ctx.doc.send(
        new BatchWriteCommand({ RequestItems: { [ctx.table]: pending } }),
      );
      pending = (out.UnprocessedItems?.[ctx.table] ?? []) as Record<string, unknown>[];
      if (pending.length > 0) await new Promise((r) => setTimeout(r, 25 * 2 ** attempt));
    }
  }
}

// Club secret (radio key) --------------------------------------------------------

export async function getClubSecret(ctx: Ctx, actor: Actor, clubId: string): Promise<ClubSecret> {
  await authorizeClub(ctx, actor, clubId, 'readClubSecret');
  const secret = await getEntity(ctx, ClubSecretSchema, keys.secret(clubId));
  if (!secret) throw notFound();
  return secret;
}

/** Stores a new radio key; the version starts at 1 and goes up on every reset. */
export async function setClubSecret(
  ctx: Ctx,
  actor: Actor,
  clubId: string,
  channelKey: Uint8Array,
): Promise<ClubSecret> {
  await authorizeClub(ctx, actor, clubId, 'writeClubSecret');
  validate(ClubSecretSchema.shape.channelKey, channelKey);
  const now = ctx.nowIso();
  try {
    await transact(ctx, [
      {
        update: keys.secret(clubId),
        set:
          'SET channelKey = :key, keyVersion = if_not_exists(keyVersion, :zero) + :one, ' +
          'clubId = :clubId, createdAt = if_not_exists(createdAt, :now), updatedAt = :now',
        condition: `${NOT_EXISTS} OR clubId = :clubId`,
        values: { ':key': channelKey, ':zero': 0, ':one': 1, ':clubId': clubId, ':now': now },
      },
      { check: keys.club(clubId), condition: EXISTS },
    ]);
  } catch (e) {
    if (e instanceof TransactionFailed) throw notFound();
    throw e;
  }
  const item = await get(ctx, keys.secret(clubId));
  if (!item) throw notFound();
  return fromItem(ClubSecretSchema, item);
}
