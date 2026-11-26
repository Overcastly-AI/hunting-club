/** High-res offline map packs: members read; only the map-pack Lambda (service) writes. */
import {
  type Club,
  ClubSchema,
  idSchema,
  type MapPack,
  MapPackCreateSchema,
  MapPackSchema,
} from '@huntclub/shared';
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
import { authorizeClub, fromItem, getEntity, notFound, validate } from './common';

export async function createMapPack(
  ctx: Ctx,
  actor: Actor,
  clubId: string,
  input: z.input<typeof MapPackCreateSchema>,
  /** The map-pack Lambda picks the id up front (it names the S3 object). */
  options: { id?: string } = {},
): Promise<MapPack> {
  await authorizeClub(ctx, actor, clubId, 'writeMapPacks');
  const fields = validate(MapPackCreateSchema, input);
  const id = options.id === undefined ? ctx.newId() : validate(idSchema, options.id);
  const now = ctx.nowIso();
  const pack: MapPack = { id, clubId, ...fields, createdAt: now, updatedAt: now };
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

/** Admin: the club to build a map pack for (its property line gives the bounds). */
export async function getClubForMapPack(ctx: Ctx, actor: Actor, clubId: string): Promise<Club> {
  await authorizeClub(ctx, actor, clubId, 'requestMapPack');
  const club = await getEntity(ctx, ClubSchema, keys.club(clubId));
  if (!club) throw notFound();
  return club;
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
