/**
 * Club map packs. An admin starts a build (one at a time per club); the map-pack
 * Lambda (service) marks it ready or failed. Members read them.
 */
import {
  type Club,
  ClubSchema,
  idSchema,
  MAP_PACK_BUILD,
  MAP_PACK_REASON_MAX,
  type MapPack,
  type MapPackReady,
  MapPackReadySchema,
  MapPackSchema,
  type MapPackStart,
  MapPackStartSchema,
  mapPackKey,
} from '@huntclub/shared';
import type { Actor } from '../actor';
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
  update,
} from '../db';
import { ClubDataError } from '../errors';
import { ATTR, CLUB_COLLECTIONS, epochSeconds, keys, readExpiry, withExpiry } from '../items';
import { TTL_ATTRIBUTE } from '../table';
import { authorizeClub, fromItem, getEntity, notFound, validate } from './common';

/** A build holds both: one per club, and one account-wide (the builder runs one at a time). */
const buildLocks = (clubId: string) =>
  [keys.mapPackBuild(clubId), keys.mapPackBuildGlobal] as const;

/** Admin: the club to build a map pack for (its property line gives the bounds). */
export async function getClubForMapPack(ctx: Ctx, actor: Actor, clubId: string): Promise<Club> {
  await authorizeClub(ctx, actor, clubId, 'requestMapPack');
  const club = await getEntity(ctx, ClubSchema, keys.club(clubId));
  if (!club) throw notFound();
  return club;
}

/**
 * Admin: records a pack as `building` and takes the club's build lock. Both expire
 * after MAP_PACK_BUILD.lockSeconds, so a builder that dies never blocks the club.
 * `conflict` while another build is pending.
 */
export async function startMapPackBuild(
  ctx: Ctx,
  actor: Actor,
  clubId: string,
  input: MapPackStart,
  /** The API picks the id up front (it names the S3 object and the Lambda's job). */
  options: { id?: string } = {},
): Promise<MapPack> {
  await authorizeClub(ctx, actor, clubId, 'requestMapPack');
  const fields = validate(MapPackStartSchema, input);
  const id = options.id === undefined ? ctx.newId() : validate(idSchema, options.id);
  const now = ctx.now();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + MAP_PACK_BUILD.lockSeconds * 1000).toISOString();
  const pack: MapPack = {
    id,
    clubId,
    ...fields,
    s3Key: mapPackKey(clubId, id),
    status: 'building',
    expiresAt,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const takeLock = (lock: ReturnType<typeof buildLocks>[number]) => ({
    put: withExpiry({ ...lock, packId: id, expiresAt }),
    // Free, or held by a build whose time is up.
    condition: `${NOT_EXISTS} OR #exp <= :nowSec`,
    names: { '#exp': TTL_ATTRIBUTE },
    values: { ':nowSec': epochSeconds(now) },
  });
  const [clubLock, globalLock] = buildLocks(clubId);
  try {
    await transact(ctx, [
      { check: keys.club(clubId), condition: EXISTS },
      takeLock(clubLock),
      takeLock(globalLock),
      {
        put: withExpiry({ ...keys.inClub(clubId, 'mapPack', id), ...pack }),
        condition: NOT_EXISTS,
      },
    ]);
  } catch (e) {
    if (e instanceof TransactionFailed && e.failed.has(1)) {
      throw new ClubDataError('conflict', 'a map pack is already being built for this club');
    }
    if (e instanceof TransactionFailed && e.failed.has(2)) {
      throw new ClubDataError(
        'conflict',
        'another map pack is being built; try again in a few minutes',
      );
    }
    if (e instanceof TransactionFailed) throw notFound();
    throw e;
  }
  return pack;
}

/** Service: a building pack is now ready to download. */
export function finishMapPack(
  ctx: Ctx,
  actor: Actor,
  clubId: string,
  id: string,
  input: MapPackReady,
): Promise<MapPack> {
  return settle(ctx, actor, clubId, id, () => ({
    status: 'ready',
    ...validate(MapPackReadySchema, input),
  }));
}

/** Service: a build failed; `reason` is a short sentence for admins (no stack traces). */
export function failMapPack(
  ctx: Ctx,
  actor: Actor,
  clubId: string,
  id: string,
  reason: string,
): Promise<MapPack> {
  return settle(ctx, actor, clubId, id, () => ({
    status: 'failed',
    reason: reason.trim().slice(0, MAP_PACK_REASON_MAX) || 'build failed',
  }));
}

/**
 * Ends a build: sets the outcome (built after the authorization check, so unauthorized
 * callers never reach validation), drops the expiry, releases the club's lock.
 */
async function settle(
  ctx: Ctx,
  actor: Actor,
  clubId: string,
  id: string,
  outcome: () => Record<string, unknown>,
): Promise<MapPack> {
  await authorizeClub(ctx, actor, clubId, 'writeMapPacks');
  const set = setFields(outcome(), ctx.nowIso());
  let item;
  try {
    item = await update(ctx, keys.inClub(clubId, 'mapPack', id), `${set.expression} REMOVE #exp`, {
      condition: `${EXISTS} AND #status = :building`,
      names: { ...set.names, '#status': 'status', '#exp': TTL_ATTRIBUTE },
      values: { ...set.values, ':building': 'building' },
    });
  } catch (e) {
    if (e instanceof ConditionFailed) throw notFound();
    throw e;
  }
  for (const lock of buildLocks(clubId)) {
    try {
      // Only this build's lock: a newer build may hold it once ours timed out.
      await remove(ctx, lock, { condition: 'packId = :id', values: { ':id': id } });
    } catch (e) {
      if (!(e instanceof ConditionFailed)) throw e;
    }
  }
  return fromItem(MapPackSchema, item);
}

/** A pack still `building` after its expiry: its builder died (DynamoDB TTL removes it later). */
const TIMED_OUT = 'the build did not finish in time';

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
  const now = ctx.now().getTime();
  return items.map((i) => {
    const pack = fromItem(MapPackSchema, readExpiry(i));
    if (pack.status !== 'building' || Date.parse(pack.expiresAt) > now) return pack;
    const { expiresAt: _expired, ...rest } = pack;
    return { ...rest, status: 'failed', reason: TIMED_OUT };
  });
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
