import {
  ENTITLED_SUBSCRIPTION_STATUSES,
  type Invite,
  InviteCreateSchema,
  InviteSchema,
  type Member,
  MemberJoinSchema,
  type MemberJoin,
  PlanSchema,
  SubscriptionSchema,
  isEntitledStatus,
} from '@huntclub/shared';
import type { z } from 'zod';
import type { Actor } from '../actor';
import { isActiveMembership, requireUser } from '../authz';
import {
  ConditionFailed,
  type Ctx,
  EXISTS,
  get,
  type Item,
  NOT_EXISTS,
  queryAll,
  remove,
  transact,
  TransactionFailed,
  type TxItem,
} from '../db';
import { ClubDataError } from '../errors';
import { ATTR, gsi1Keys, keys, ttlFor } from '../items';
import { authorizeClub, fromItem, getEntity, getMember, notFound, validate } from './common';
import { MEMBER_SLOT_FREE, memberItem } from './members';
import { seatChange } from './seats';

function inviteItem(invite: Invite): Item {
  return {
    ...keys.invite(invite.token),
    ...gsi1Keys.clubInvite(invite.clubId, invite.id),
    ...invite,
    [ATTR.TTL]: ttlFor(invite.expiresAt),
  };
}

export async function createInvite(
  ctx: Ctx,
  actor: Actor,
  clubId: string,
  input: z.input<typeof InviteCreateSchema>,
): Promise<Invite> {
  await authorizeClub(ctx, actor, clubId, 'manageInvites');
  const fields = validate(InviteCreateSchema, input);
  const now = ctx.nowIso();
  const invite: Invite = {
    id: ctx.newId(),
    clubId,
    token: ctx.newInviteToken(),
    ...fields,
    uses: 0,
    ...(actor.kind === 'user' ? { createdBy: actor.userId } : {}),
    createdAt: now,
    updatedAt: now,
  };
  try {
    await transact(ctx, [
      { put: inviteItem(invite), condition: NOT_EXISTS },
      { check: keys.club(clubId), condition: EXISTS },
    ]);
  } catch (e) {
    if (e instanceof TransactionFailed)
      throw e.failed.has(1) ? notFound() : new ClubDataError('conflict');
    throw e;
  }
  return invite;
}

const clubInviteItems = (ctx: Ctx, clubId: string, inviteId?: string) =>
  queryAll(ctx, {
    IndexName: 'GSI1',
    KeyConditionExpression: inviteId ? '#pk = :pk AND #sk = :sk' : '#pk = :pk',
    ExpressionAttributeNames: { '#pk': ATTR.GPK, ...(inviteId ? { '#sk': ATTR.GSK } : {}) },
    ExpressionAttributeValues: {
      ':pk': gsi1Keys.clubInvitesPartition(clubId),
      ...(inviteId ? { ':sk': gsi1Keys.clubInvite(clubId, inviteId)[ATTR.GSK] } : {}),
    },
  });

export async function listInvites(ctx: Ctx, actor: Actor, clubId: string): Promise<Invite[]> {
  await authorizeClub(ctx, actor, clubId, 'manageInvites');
  return (await clubInviteItems(ctx, clubId)).map((i) => fromItem(InviteSchema, i));
}

/** Revokes an invite (admin). */
export async function deleteInvite(
  ctx: Ctx,
  actor: Actor,
  clubId: string,
  inviteId: string,
): Promise<void> {
  await authorizeClub(ctx, actor, clubId, 'manageInvites');
  const [item] = await clubInviteItems(ctx, clubId, inviteId);
  if (!item) throw notFound();
  const invite = fromItem(InviteSchema, item);
  try {
    await remove(ctx, keys.invite(invite.token), {
      condition: 'attribute_exists(#pk) AND clubId = :clubId',
      names: { '#pk': ATTR.PK },
      values: { ':clubId': clubId },
    });
  } catch (e) {
    if (e instanceof ConditionFailed) throw notFound();
    throw e;
  }
}

/**
 * Joins the caller to the invite's club (SPEC "Setting up a club", step 4).
 *
 * One TransactWriteItems commits the membership only if, at that instant: the
 * invite is unexpired and has uses left (and its use count goes up), the club's
 * subscription is entitled and on the plan whose limit we read, the club has a free
 * seat (non-guests only; the seat counter goes up), and the user has no membership
 * other than an expired guest pass (which is renewed in place). Concurrent
 * redemptions therefore can't exceed max uses or the member limit.
 *
 * Re-scanning an invite while already an active member returns that membership and
 * consumes no use.
 */
export async function redeemInvite(
  ctx: Ctx,
  actor: Actor,
  token: string,
  profile: MemberJoin,
): Promise<Member> {
  const userId = requireUser(actor);
  const join = validate(MemberJoinSchema, profile);
  const inviteItemFound = await get(ctx, keys.invite(token));
  if (!inviteItemFound) throw new ClubDataError('invite_not_found');
  const invite = fromItem(InviteSchema, inviteItemFound);
  const { clubId } = invite;

  const existing = await getMember(ctx, clubId, userId);
  if (existing && isActiveMembership(existing, ctx.now())) return existing;

  const now = ctx.nowIso();
  if (invite.expiresAt <= now) throw new ClubDataError('invite_expired');
  if (invite.maxUses !== undefined && invite.uses >= invite.maxUses) {
    throw new ClubDataError('invite_used_up');
  }
  const subscription = await getEntity(ctx, SubscriptionSchema, keys.subscription(clubId));
  if (!subscription || !isEntitledStatus(subscription.status)) {
    throw new ClubDataError('club_inactive');
  }
  const plan = await getEntity(ctx, PlanSchema, keys.plan(subscription.planId));
  if (!plan) throw new ClubDataError('club_inactive');

  const member: Member = {
    clubId,
    userId,
    ...join,
    role: invite.role,
    ...(invite.memberExpiresAt ? { expiresAt: invite.memberExpiresAt } : {}),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const statuses = Object.fromEntries(ENTITLED_SUBSCRIPTION_STATUSES.map((s, i) => [`:s${i}`, s]));
  const seats = seatChange(clubId, {
    to: member.role,
    ...(plan.memberLimit !== undefined ? { seatLimit: plan.memberLimit } : {}),
  });
  const tx: TxItem[] = [
    {
      update: keys.invite(token),
      set: 'SET uses = uses + :one, updatedAt = :now',
      condition:
        'attribute_exists(#pk) AND expiresAt > :now AND (attribute_not_exists(maxUses) OR uses < maxUses)',
      names: { '#pk': ATTR.PK },
      values: { ':one': 1, ':now': now },
    },
    {
      check: keys.subscription(clubId),
      condition: `#status IN (${Object.keys(statuses).join(', ')}) AND planId = :planId`,
      names: { '#status': 'status' },
      values: { ...statuses, ':planId': subscription.planId },
    },
    { put: memberItem(member), condition: MEMBER_SLOT_FREE, values: { ':now': now } },
    ...(seats ? [seats] : []),
  ];
  try {
    await transact(ctx, tx);
  } catch (e) {
    if (!(e instanceof TransactionFailed)) throw e;
    return redeemFailure(ctx, e.failed, { token, clubId, userId });
  }
  return member;
}

/** Explains a cancelled redemption (indexes match the transaction above). */
async function redeemFailure(
  ctx: Ctx,
  failed: ReadonlySet<number>,
  ids: { token: string; clubId: string; userId: string },
): Promise<Member> {
  if (failed.has(2)) {
    // Joined concurrently (e.g. a double scan): same result as a repeat redemption.
    const member = await getMember(ctx, ids.clubId, ids.userId);
    if (member && isActiveMembership(member, ctx.now())) return member;
    throw new ClubDataError('conflict');
  }
  if (failed.has(0)) {
    const item = await get(ctx, keys.invite(ids.token));
    if (!item) throw new ClubDataError('invite_not_found');
    const invite = fromItem(InviteSchema, item);
    throw new ClubDataError(invite.expiresAt <= ctx.nowIso() ? 'invite_expired' : 'invite_used_up');
  }
  if (failed.has(1)) throw new ClubDataError('club_inactive');
  throw new ClubDataError('club_full');
}
