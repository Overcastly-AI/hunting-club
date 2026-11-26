import {
  type Member,
  MemberAccessUpdateSchema,
  MemberAddSchema,
  MemberProfileUpdateSchema,
  MemberSchema,
} from '@huntclub/shared';
import type { z } from 'zod';
import type { Actor } from '../actor';
import { authorize } from '../authz';
import {
  ConditionFailed,
  type Ctx,
  EXISTS,
  type Item,
  NOT_EXISTS,
  queryAll,
  setFields,
  transact,
  TransactionFailed,
  type TxItem,
  update,
} from '../db';
import { ClubDataError } from '../errors';
import { ATTR, CLUB_COLLECTIONS, gsi1Keys, keys, ttlFor } from '../items';
import { accessTo, authorizeClub, fromItem, getMember, notFound, validate } from './common';
import { seatChange } from './seats';

/** Member → item: keyed in the club partition, indexed by user, TTL on guest passes. */
export function memberItem(member: Member): Item {
  return {
    ...keys.inClub(member.clubId, 'member', member.userId),
    ...gsi1Keys.memberOfUser(member.userId, member.clubId),
    ...member,
    ...(member.expiresAt ? { [ATTR.TTL]: ttlFor(member.expiresAt) } : {}),
  };
}

/** A membership slot is free when there is no item or only an expired guest pass. */
export const MEMBER_SLOT_FREE = `${NOT_EXISTS} OR expiresAt <= :now`;

/** Seat-counter failures in a roster transaction become these errors. */
function rosterError(seatFailed: boolean, removingAdmin: boolean): ClubDataError {
  if (seatFailed && removingAdmin)
    return new ClubDataError('last_admin', 'a club must keep at least one admin');
  return new ClubDataError('conflict', 'the roster changed; retry');
}

export async function listMembers(ctx: Ctx, actor: Actor, clubId: string): Promise<Member[]> {
  await authorizeClub(ctx, actor, clubId, 'readRoster');
  const items = await queryAll(ctx, {
    KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :prefix)',
    ExpressionAttributeNames: { '#pk': ATTR.PK, '#sk': ATTR.SK },
    ExpressionAttributeValues: {
      ':pk': keys.clubPartition(clubId)[ATTR.PK],
      ':prefix': CLUB_COLLECTIONS.member,
    },
  });
  return items.map((i) => fromItem(MemberSchema, i));
}

/** Admin adds a user directly (not through an invite). */
export async function addMember(
  ctx: Ctx,
  actor: Actor,
  clubId: string,
  input: z.input<typeof MemberAddSchema>,
): Promise<Member> {
  await authorizeClub(ctx, actor, clubId, 'addMember');
  const fields = validate(MemberAddSchema, input);
  const now = ctx.nowIso();
  const member: Member = { clubId, ...fields, createdAt: now, updatedAt: now };
  const seats = seatChange(clubId, { to: member.role });
  try {
    await transact(ctx, [
      { put: memberItem(member), condition: MEMBER_SLOT_FREE, values: { ':now': now } },
      ...(seats ? [seats] : [{ check: keys.club(clubId), condition: EXISTS } satisfies TxItem]),
    ]);
  } catch (e) {
    if (!(e instanceof TransactionFailed)) throw e;
    if (e.failed.has(0)) throw new ClubDataError('conflict', 'already a member of this club');
    throw notFound();
  }
  return member;
}

/** Name, initials and radio: the member themselves, or an admin. */
export async function updateMemberProfile(
  ctx: Ctx,
  actor: Actor,
  clubId: string,
  userId: string,
  patch: z.input<typeof MemberProfileUpdateSchema>,
): Promise<Member> {
  const access = await accessTo(ctx, actor, clubId);
  authorize(access, 'editMemberProfile', { userId });
  const fields = validate(MemberProfileUpdateSchema, patch);
  const set = setFields(fields, ctx.nowIso());
  try {
    const item = await update(ctx, keys.inClub(clubId, 'member', userId), set.expression, {
      ...set,
      condition: EXISTS,
    });
    return fromItem(MemberSchema, item);
  } catch (e) {
    if (e instanceof ConditionFailed) throw notFound();
    throw e;
  }
}

/** Admin only: change role and guest-pass expiry. The last admin can't step down. */
export async function setMemberAccess(
  ctx: Ctx,
  actor: Actor,
  clubId: string,
  userId: string,
  input: z.input<typeof MemberAccessUpdateSchema>,
): Promise<Member> {
  await authorizeClub(ctx, actor, clubId, 'setMemberAccess');
  const next = validate(MemberAccessUpdateSchema, input);
  const current = await getMember(ctx, clubId, userId);
  if (!current) throw notFound();
  const now = ctx.nowIso();
  const updated: Member = { ...current, ...next, updatedAt: now };
  if (next.expiresAt === undefined) delete updated.expiresAt;
  const seats = seatChange(clubId, { from: current.role, to: next.role });
  try {
    await transact(ctx, [
      {
        put: memberItem(updated),
        // Unchanged since read, so the counters move from the right role.
        condition: 'attribute_exists(#pk) AND #role = :role AND updatedAt = :updatedAt',
        names: { '#pk': ATTR.PK, '#role': 'role' },
        values: { ':role': current.role, ':updatedAt': current.updatedAt },
      },
      ...(seats ? [seats] : []),
    ]);
  } catch (e) {
    if (!(e instanceof TransactionFailed)) throw e;
    throw rosterError(e.failed.has(1), current.role === 'admin');
  }
  return updated;
}

/** Admin removes someone, or a member leaves. The last admin can't leave. */
export async function removeMember(
  ctx: Ctx,
  actor: Actor,
  clubId: string,
  userId: string,
): Promise<void> {
  const access = await accessTo(ctx, actor, clubId);
  authorize(access, 'removeMember', { userId });
  const current = await getMember(ctx, clubId, userId);
  if (!current) throw notFound();
  const seats = seatChange(clubId, { from: current.role });
  try {
    await transact(ctx, [
      {
        delete: keys.inClub(clubId, 'member', userId),
        condition: 'attribute_exists(#pk) AND #role = :role',
        names: { '#pk': ATTR.PK, '#role': 'role' },
        values: { ':role': current.role },
      },
      ...(seats ? [seats] : []),
    ]);
  } catch (e) {
    if (!(e instanceof TransactionFailed)) throw e;
    throw rosterError(e.failed.has(1), current.role === 'admin');
  }
}
