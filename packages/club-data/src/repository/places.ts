/**
 * Stands and areas ("places"): members read, admins write. Each gets a mesh id,
 * the short number the radio protocol sends instead of the UUID: per club and kind,
 * from 1, allocated atomically from a counter item, never reused (a radio holding an
 * old id must never resolve it to a new place) and never changed.
 */
import {
  AreaCreateSchema,
  AreaSchema,
  AreaUpdateSchema,
  StandCreateSchema,
  StandSchema,
  StandUpdateSchema,
  UINT32_MAX,
} from '@huntclub/shared';
import type { z } from 'zod';
import type { Actor } from '../actor';
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
  type TxItem,
  update,
} from '../db';
import { ClubDataError } from '../errors';
import { ATTR, CLUB_COLLECTIONS, type ClubCollection, keys, type PlaceKind } from '../items';
import { authorizeClub, fromItem, notFound, validate } from './common';

const PLACES = {
  area: { entity: AreaSchema, create: AreaCreateSchema, update: AreaUpdateSchema },
  stand: { entity: StandSchema, create: StandCreateSchema, update: StandUpdateSchema },
} as const;
type Places = typeof PLACES;
export type Place<K extends PlaceKind> = z.output<Places[K]['entity']>;

/** Items that may point at a place, by the attribute that holds its id. */
const REFERENCES: Record<PlaceKind, { attr: string; collections: ClubCollection[] }> = {
  area: { attr: 'areaId', collections: ['stand', 'harvest'] },
  stand: { attr: 'standId', collections: ['harvest'] },
};

/** Atomically takes the next mesh id for this club and kind. */
export async function allocateMeshId(ctx: Ctx, clubId: string, kind: PlaceKind): Promise<number> {
  try {
    const out = await update(ctx, keys.meshCounter(clubId, kind), 'ADD lastValue :one', {
      condition: 'attribute_not_exists(lastValue) OR lastValue < :max',
      values: { ':one': 1, ':max': UINT32_MAX },
    });
    return Number(out.lastValue);
  } catch (e) {
    if (e instanceof ConditionFailed) throw new ClubDataError('conflict', 'mesh ids exhausted');
    throw e;
  }
}

/** Checks a stand's area exists in the same club (a stand can't use another club's area). */
const areaCheck = (clubId: string, areaId: string | undefined): TxItem[] =>
  areaId ? [{ check: keys.inClub(clubId, 'area', areaId), condition: EXISTS }] : [];

function placeFailure(e: unknown): never {
  if (e instanceof TransactionFailed) {
    if (e.failed.has(0)) throw notFound();
    if (e.failed.has(1)) throw new ClubDataError('invalid', 'area not found in this club');
  }
  throw e;
}

export async function createPlace<K extends PlaceKind>(
  ctx: Ctx,
  actor: Actor,
  clubId: string,
  kind: K,
  input: z.input<Places[K]['create']>,
): Promise<Place<K>> {
  await authorizeClub(ctx, actor, clubId, 'writePlaces');
  const fields = validate(PLACES[kind].create, input);
  const meshId = await allocateMeshId(ctx, clubId, kind);
  const now = ctx.nowIso();
  const place = { id: ctx.newId(), clubId, meshId, ...fields, createdAt: now, updatedAt: now };
  try {
    await transact(ctx, [
      { check: keys.club(clubId), condition: EXISTS },
      ...areaCheck(clubId, 'areaId' in fields ? fields.areaId : undefined),
      { put: { ...keys.inClub(clubId, kind, place.id), ...place }, condition: NOT_EXISTS },
    ]);
  } catch (e) {
    placeFailure(e);
  }
  return fromItem(PLACES[kind].entity, place) as Place<K>;
}

export async function listPlaces<K extends PlaceKind>(
  ctx: Ctx,
  actor: Actor,
  clubId: string,
  kind: K,
): Promise<Place<K>[]> {
  await authorizeClub(ctx, actor, clubId, 'readPlaces');
  const items = await queryAll(ctx, {
    KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :prefix)',
    ExpressionAttributeNames: { '#pk': ATTR.PK, '#sk': ATTR.SK },
    ExpressionAttributeValues: {
      ':pk': keys.clubPartition(clubId)[ATTR.PK],
      ':prefix': CLUB_COLLECTIONS[kind],
    },
  });
  return items.map((i) => fromItem(PLACES[kind].entity, i) as Place<K>);
}

/** Edits a place. id, clubId and meshId are not editable (strict input rejects them). */
export async function updatePlace<K extends PlaceKind>(
  ctx: Ctx,
  actor: Actor,
  clubId: string,
  kind: K,
  id: string,
  patch: z.input<Places[K]['update']>,
): Promise<Place<K>> {
  await authorizeClub(ctx, actor, clubId, 'writePlaces');
  const fields = validate(PLACES[kind].update, patch);
  const key = keys.inClub(clubId, kind, id);
  const set = setFields(fields, ctx.nowIso());
  try {
    await transact(ctx, [
      { update: key, set: set.expression, names: set.names, values: set.values, condition: EXISTS },
      ...areaCheck(clubId, 'areaId' in fields ? fields.areaId : undefined),
    ]);
  } catch (e) {
    placeFailure(e);
  }
  const item = await get(ctx, key);
  if (!item) throw notFound();
  return fromItem(PLACES[kind].entity, item) as Place<K>;
}

/**
 * Deletes a place, then clears references to it (stands in a deleted area,
 * harvests at a deleted stand or area), like Postgres' `on delete set null`.
 * Its mesh id is never handed out again.
 */
export async function deletePlace(
  ctx: Ctx,
  actor: Actor,
  clubId: string,
  kind: PlaceKind,
  id: string,
): Promise<void> {
  await authorizeClub(ctx, actor, clubId, 'writePlaces');
  try {
    await transact(ctx, [{ delete: keys.inClub(clubId, kind, id), condition: EXISTS }]);
  } catch (e) {
    placeFailure(e);
  }
  const { attr, collections } = REFERENCES[kind];
  for (const collection of collections) {
    const referencing = await queryAll(ctx, {
      KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :prefix)',
      FilterExpression: '#ref = :id',
      ExpressionAttributeNames: { '#pk': ATTR.PK, '#sk': ATTR.SK, '#ref': attr },
      ExpressionAttributeValues: {
        ':pk': keys.clubPartition(clubId)[ATTR.PK],
        ':prefix': CLUB_COLLECTIONS[collection],
        ':id': id,
      },
    });
    for (const item of referencing) {
      try {
        await update(
          ctx,
          { [ATTR.PK]: String(item[ATTR.PK]), [ATTR.SK]: String(item[ATTR.SK]) },
          'REMOVE #ref',
          { condition: '#ref = :id', names: { '#ref': attr }, values: { ':id': id } },
        );
      } catch (e) {
        if (!(e instanceof ConditionFailed)) throw e; // already changed: nothing to clear
      }
    }
  }
}

/** The four operations for one kind of place, with the kind fixed (typed API). */
export function placeOperations<K extends PlaceKind>(kind: K) {
  return {
    create: (ctx: Ctx, actor: Actor, clubId: string, input: z.input<Places[K]['create']>) =>
      createPlace(ctx, actor, clubId, kind, input),
    list: (ctx: Ctx, actor: Actor, clubId: string) => listPlaces(ctx, actor, clubId, kind),
    update: (
      ctx: Ctx,
      actor: Actor,
      clubId: string,
      id: string,
      patch: z.input<Places[K]['update']>,
    ) => updatePlace(ctx, actor, clubId, kind, id, patch),
    delete: (ctx: Ctx, actor: Actor, clubId: string, id: string) =>
      deletePlace(ctx, actor, clubId, kind, id),
  };
}
