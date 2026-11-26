/**
 * Harvests a member shared with their club. The hunter always sees and edits their
 * own; the rest of the club sees one only while `shared`; admins may remove shared
 * ones (moderation). Logging requires an active membership of that club.
 */
import {
  type Harvest,
  HarvestCreateSchema,
  HarvestSchema,
  HarvestUpdateSchema,
} from '@huntclub/shared';
import type { z } from 'zod';
import type { Actor } from '../actor';
import { authorize, can, requireUser } from '../authz';
import {
  ConditionFailed,
  type Ctx,
  EXISTS,
  NOT_EXISTS,
  queryAll,
  remove,
  setFields,
  transact,
  TransactionFailed,
  type TxItem,
} from '../db';
import { ClubDataError } from '../errors';
import { ATTR, CLUB_COLLECTIONS, keys, notExpired } from '../items';
import { accessTo, fromItem, getEntity, notFound, validate } from './common';

/** ConditionCheck: this member item exists and its guest pass (if any) is unexpired. */
function activeMemberCheck(ctx: Ctx, clubId: string, userId: string): TxItem {
  const active = notExpired(ctx.now());
  return {
    check: keys.inClub(clubId, 'member', userId),
    condition: `attribute_exists(#pk) AND ${active.condition}`,
    names: { ...active.names, '#pk': ATTR.PK },
    values: active.values,
  };
}

/** Stand and area references must exist in the same club. */
function placeChecks(clubId: string, h: { standId?: string; areaId?: string }): TxItem[] {
  return [
    ...(h.standId ? [{ check: keys.inClub(clubId, 'stand', h.standId), condition: EXISTS }] : []),
    ...(h.areaId ? [{ check: keys.inClub(clubId, 'area', h.areaId), condition: EXISTS }] : []),
  ];
}

function harvestFailure(e: unknown, notFoundIndex: number): never {
  if (e instanceof TransactionFailed) {
    if (e.failed.has(notFoundIndex)) throw notFound();
    if (e.failed.has(1)) throw new ClubDataError('forbidden');
    throw new ClubDataError('invalid', 'stand or area not found in this club');
  }
  throw e;
}

/** Logs a harvest as the caller (never as someone else). */
export async function createHarvest(
  ctx: Ctx,
  actor: Actor,
  clubId: string,
  input: z.input<typeof HarvestCreateSchema>,
): Promise<Harvest> {
  const access = await accessTo(ctx, actor, clubId);
  const userId = requireUser(actor);
  authorize(access, 'writeOwnHarvest', { userId });
  const fields = validate(HarvestCreateSchema, input);
  const now = ctx.nowIso();
  const harvest: Harvest = {
    id: ctx.newId(),
    clubId,
    userId,
    ...fields,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await transact(ctx, [
      { put: { ...keys.inClub(clubId, 'harvest', harvest.id), ...harvest }, condition: NOT_EXISTS },
      activeMemberCheck(ctx, clubId, userId),
      ...placeChecks(clubId, fields),
    ]);
  } catch (e) {
    harvestFailure(e, 0);
  }
  return harvest;
}

/** The harvests in this club the caller may see. */
export async function listHarvests(ctx: Ctx, actor: Actor, clubId: string): Promise<Harvest[]> {
  const access = await accessTo(ctx, actor, clubId);
  if (actor.kind === 'anonymous') throw new ClubDataError('not_authenticated');
  const items = await queryAll(ctx, {
    KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :prefix)',
    ExpressionAttributeNames: { '#pk': ATTR.PK, '#sk': ATTR.SK },
    ExpressionAttributeValues: {
      ':pk': keys.clubPartition(clubId)[ATTR.PK],
      ':prefix': CLUB_COLLECTIONS.harvest,
    },
  });
  return items.map((i) => fromItem(HarvestSchema, i)).filter((h) => can(access, 'readHarvest', h));
}

/** Loads a harvest the caller may see; hidden ones look like missing ones. */
async function visibleHarvest(ctx: Ctx, actor: Actor, clubId: string, id: string) {
  const access = await accessTo(ctx, actor, clubId);
  const harvest = await getEntity(ctx, HarvestSchema, keys.inClub(clubId, 'harvest', id));
  if (!harvest || !can(access, 'readHarvest', harvest)) {
    if (actor.kind === 'anonymous') throw new ClubDataError('not_authenticated');
    throw notFound();
  }
  return { access, harvest };
}

/** The hunter edits (or shares/unshares) their own harvest. */
export async function updateHarvest(
  ctx: Ctx,
  actor: Actor,
  clubId: string,
  id: string,
  patch: z.input<typeof HarvestUpdateSchema>,
): Promise<Harvest> {
  const { access, harvest } = await visibleHarvest(ctx, actor, clubId, id);
  authorize(access, 'writeOwnHarvest', harvest);
  const fields = validate(HarvestUpdateSchema, patch);
  const set = setFields(fields, ctx.nowIso());
  const now = ctx.nowIso();
  try {
    await transact(ctx, [
      {
        update: keys.inClub(clubId, 'harvest', id),
        set: set.expression,
        condition: 'attribute_exists(#pk) AND userId = :owner',
        names: { ...set.names, '#pk': ATTR.PK },
        values: { ...set.values, ':owner': harvest.userId },
      },
      activeMemberCheck(ctx, clubId, harvest.userId),
      ...placeChecks(clubId, fields),
    ]);
  } catch (e) {
    harvestFailure(e, 0);
  }
  const updated = await getEntity(ctx, HarvestSchema, keys.inClub(clubId, 'harvest', id));
  if (!updated) throw notFound();
  return updated;
}

/** The hunter deletes their own; an admin may remove a shared one. */
export async function deleteHarvest(
  ctx: Ctx,
  actor: Actor,
  clubId: string,
  id: string,
): Promise<void> {
  const { access, harvest } = await visibleHarvest(ctx, actor, clubId, id);
  authorize(access, 'deleteHarvest', harvest);
  try {
    // Unchanged since the check (e.g. not unshared in between).
    await remove(ctx, keys.inClub(clubId, 'harvest', id), {
      condition: 'attribute_exists(#pk) AND updatedAt = :updatedAt',
      names: { '#pk': ATTR.PK },
      values: { ':updatedAt': harvest.updatedAt },
    });
  } catch (e) {
    if (e instanceof ConditionFailed) throw new ClubDataError('conflict');
    throw e;
  }
}
