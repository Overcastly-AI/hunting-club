/** High-res offline map packs: members read; only the map-pack Lambda (service) writes. */
import { type MapPack, MapPackCreateSchema, MapPackSchema } from '@huntclub/shared';
import type { z } from 'zod';
import type { Actor } from '../actor';
import {
  ConditionFailed,
  type Ctx,
  EXISTS,
  NOT_EXISTS,
  queryAll,
  remove,
  transact,
  TransactionFailed,
} from '../db';
import { ATTR, CLUB_COLLECTIONS, keys } from '../items';
import { authorizeClub, fromItem, notFound, validate } from './common';

export async function createMapPack(
  ctx: Ctx,
  actor: Actor,
  clubId: string,
  input: z.input<typeof MapPackCreateSchema>,
): Promise<MapPack> {
  await authorizeClub(ctx, actor, clubId, 'writeMapPacks');
  const fields = validate(MapPackCreateSchema, input);
  const now = ctx.nowIso();
  const pack: MapPack = { id: ctx.newId(), clubId, ...fields, createdAt: now, updatedAt: now };
  try {
    await transact(ctx, [
      { check: keys.club(clubId), condition: EXISTS },
      { put: { ...keys.inClub(clubId, 'mapPack', pack.id), ...pack }, condition: NOT_EXISTS },
    ]);
  } catch (e) {
    if (e instanceof TransactionFailed) throw notFound();
    throw e;
  }
  return pack;
}

export async function listMapPacks(ctx: Ctx, actor: Actor, clubId: string): Promise<MapPack[]> {
  await authorizeClub(ctx, actor, clubId, 'readMapPacks');
  const items = await queryAll(ctx, {
    KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :prefix)',
    ExpressionAttributeNames: { '#pk': ATTR.PK, '#sk': ATTR.SK },
    ExpressionAttributeValues: {
      ':pk': keys.clubPartition(clubId)[ATTR.PK],
      ':prefix': CLUB_COLLECTIONS.mapPack,
    },
  });
  return items.map((i) => fromItem(MapPackSchema, i));
}

export async function deleteMapPack(
  ctx: Ctx,
  actor: Actor,
  clubId: string,
  id: string,
): Promise<void> {
  await authorizeClub(ctx, actor, clubId, 'writeMapPacks');
  try {
    await remove(ctx, keys.inClub(clubId, 'mapPack', id), { condition: EXISTS });
  } catch (e) {
    if (e instanceof ConditionFailed) throw notFound();
    throw e;
  }
}
