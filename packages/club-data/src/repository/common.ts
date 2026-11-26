import { type Member, MemberSchema } from '@huntclub/shared';
import type { z } from 'zod';
import type { Actor } from '../actor';
import { type Access, authorize, type ResourcelessPolicy } from '../authz';
import { type Ctx, get, type Item } from '../db';
import { ClubDataError } from '../errors';
import { keys } from '../items';

/** Validates client or service input; failures become `invalid`. */
export function validate<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw new ClubDataError('invalid', result.error.issues[0]?.message);
  return result.data;
}

/**
 * Item → entity. Parsing drops the key, index, TTL and counter attributes (zod
 * objects strip unknown keys) and catches corrupt items early.
 */
export const fromItem = <S extends z.ZodType>(schema: S, item: Item): z.output<S> =>
  schema.parse(item);

export async function getEntity<S extends z.ZodType>(
  ctx: Ctx,
  schema: S,
  key: Record<string, string>,
): Promise<z.output<S> | undefined> {
  const item = await get(ctx, key);
  return item && fromItem(schema, item);
}

export async function getMember(
  ctx: Ctx,
  clubId: string,
  userId: string,
): Promise<Member | undefined> {
  return getEntity(ctx, MemberSchema, keys.inClub(clubId, 'member', userId));
}

/** Resolves the caller's membership of the club (users only). */
export async function accessTo(ctx: Ctx, actor: Actor, clubId: string): Promise<Access> {
  const membership = actor.kind === 'user' ? await getMember(ctx, clubId, actor.userId) : undefined;
  return { actor, membership, now: ctx.now() };
}

/** accessTo + authorize for policies that take no resource. */
export async function authorizeClub(
  ctx: Ctx,
  actor: Actor,
  clubId: string,
  policy: ResourcelessPolicy,
): Promise<Access> {
  const access = await accessTo(ctx, actor, clubId);
  authorize(access, policy);
  return access;
}
/** Service-only operations that aren't scoped to one club's membership. */
export function authorizeService(actor: Actor, policy: ResourcelessPolicy) {
  authorize({ actor, membership: undefined, now: new Date() }, policy);
}

export const notFound = () => new ClubDataError('not_found');
