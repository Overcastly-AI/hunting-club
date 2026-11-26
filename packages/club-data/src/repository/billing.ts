/**
 * Plans, subscriptions and Stripe events. Only the service (the Stripe webhook
 * Lambda) writes them; admins read their club's subscription; anyone reads active
 * plans (the checkout page shows them before sign-in).
 */
import {
  ClubSchema,
  type Plan,
  PlanPutSchema,
  PlanSchema,
  type StripeEvent,
  StripeEventApplySchema,
  StripeEventSchema,
  type Subscription,
  SubscriptionSchema,
} from '@huntclub/shared';
import type { z } from 'zod';
import type { Actor } from '../actor';
import { type Ctx, NOT_EXISTS, put, queryAll, transact, TransactionFailed } from '../db';
import { ClubDataError } from '../errors';
import { ATTR, GSI1, gsi1Keys, keys } from '../items';
import { PLACEHOLDER_PLANS } from '../plans';
import { authorizeClub, authorizeService, fromItem, getEntity, notFound, validate } from './common';

/** Active plans for everyone; the service also sees retired ones. */
export async function listPlans(ctx: Ctx, actor: Actor): Promise<Plan[]> {
  const items = await queryAll(ctx, {
    IndexName: GSI1,
    KeyConditionExpression: '#pk = :pk',
    ExpressionAttributeNames: { '#pk': ATTR.GPK },
    ExpressionAttributeValues: { ':pk': gsi1Keys.plansPartition() },
  });
  const plans = items.map((i) => fromItem(PlanSchema, i));
  return actor.kind === 'service' ? plans : plans.filter((p) => p.active);
}

/** Service only: creates or replaces a plan (config). */
export async function putPlan(
  ctx: Ctx,
  actor: Actor,
  input: z.input<typeof PlanPutSchema>,
): Promise<Plan> {
  authorizeService(actor, 'writeBilling');
  const fields = validate(PlanPutSchema, input);
  const existing = await getEntity(ctx, PlanSchema, keys.plan(fields.id));
  const now = ctx.nowIso();
  const plan: Plan = { ...fields, createdAt: existing?.createdAt ?? now, updatedAt: now };
  await put(
    ctx,
    { ...keys.plan(plan.id), ...gsi1Keys.plan(plan.id), ...plan },
    {
      // Never overwrite a newer write than the one we read.
      condition: existing ? 'updatedAt = :seen' : NOT_EXISTS,
      ...(existing ? { values: { ':seen': existing.updatedAt } } : {}),
    },
  );
  return plan;
}

/** Service only: writes PLACEHOLDER_PLANS that don't exist yet (safe to re-run). */
export async function seedPlans(ctx: Ctx, actor: Actor): Promise<void> {
  authorizeService(actor, 'writeBilling');
  const existing = new Set((await listPlans(ctx, actor)).map((p) => p.id));
  for (const plan of PLACEHOLDER_PLANS) {
    if (!existing.has(plan.id)) await putPlan(ctx, actor, plan);
  }
}

export async function getSubscription(
  ctx: Ctx,
  actor: Actor,
  clubId: string,
): Promise<Subscription> {
  await authorizeClub(ctx, actor, clubId, 'readSubscription');
  const sub = await getEntity(ctx, SubscriptionSchema, keys.subscription(clubId));
  if (!sub) throw notFound();
  return sub;
}

/** The club an admin may buy a subscription for (Stripe Checkout). */
export async function getBillableClub(ctx: Ctx, actor: Actor, clubId: string) {
  await authorizeClub(ctx, actor, clubId, 'manageBilling');
  const club = await getEntity(ctx, ClubSchema, keys.club(clubId));
  if (!club) throw notFound();
  return club;
}

export type ApplyStripeEventResult = 'applied' | 'duplicate';

/**
 * Service only (Stripe webhook): records the event id and writes the club's
 * subscription in ONE transaction, so both commit or neither does. A repeated event
 * id changes nothing and returns 'duplicate'. The webhook re-fetches the
 * subscription from Stripe for every event, so applying the latest state is correct
 * whatever order events arrive in.
 *
 * Every item it touches is in a billing partition (PARTITION_PREFIXES), because the
 * webhook's IAM policy allows nothing else. So it cannot check that the club or plan
 * exists: the club id comes from metadata our provisioning Lambda put on the Stripe
 * subscription, and a subscription on an unknown plan admits no one (redeemInvite
 * treats it as club_inactive).
 */
export async function applyStripeEvent(
  ctx: Ctx,
  actor: Actor,
  input: z.input<typeof StripeEventApplySchema>,
): Promise<ApplyStripeEventResult> {
  authorizeService(actor, 'writeBilling');
  const { eventId, ...sub } = validate(StripeEventApplySchema, input);
  const now = ctx.nowIso();
  const event: StripeEvent = { eventId, processedAt: now };
  const fields = Object.entries({ ...sub, updatedAt: now }).filter(([, v]) => v !== undefined);
  const clearPaidThrough = sub.paidThrough === undefined ? ' REMOVE paidThrough' : '';
  try {
    await transact(ctx, [
      { put: { ...keys.stripeEvent(eventId), ...event }, condition: NOT_EXISTS },
      {
        update: keys.subscription(sub.clubId),
        set:
          `SET ${fields.map(([k]) => `#${k} = :${k}`).join(', ')}, ` +
          `createdAt = if_not_exists(createdAt, :updatedAt)${clearPaidThrough}`,
        condition: `${NOT_EXISTS} OR #clubId = :clubId`,
        names: Object.fromEntries(fields.map(([k]) => [`#${k}`, k])),
        values: Object.fromEntries(fields.map(([k, v]) => [`:${k}`, v])),
      },
      {
        // A Stripe subscription belongs to exactly one club.
        put: { ...keys.stripeSubscription(sub.stripeSubscriptionId), clubId: sub.clubId },
        condition: `${NOT_EXISTS} OR clubId = :clubId`,
        values: { ':clubId': sub.clubId },
      },
    ]);
  } catch (e) {
    if (!(e instanceof TransactionFailed)) throw e;
    if (e.failed.has(0)) return 'duplicate';
    throw new ClubDataError('conflict', 'Stripe subscription belongs to another club');
  }
  return 'applied';
}

/** Service only: whether an event was processed (webhook diagnostics). */
export async function getStripeEvent(
  ctx: Ctx,
  actor: Actor,
  eventId: string,
): Promise<StripeEvent | undefined> {
  authorizeService(actor, 'readStripeEvents');
  return getEntity(ctx, StripeEventSchema, keys.stripeEvent(eventId));
}
