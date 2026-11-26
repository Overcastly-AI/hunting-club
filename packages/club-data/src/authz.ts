/**
 * Club authorization: the one place that decides who may do what. It enforces the
 * same rules as the former Postgres RLS policies (supabase/, PR #5):
 *
 * - Members, including guests whose pass hasn't expired, read their own club.
 * - Admins update the club, manage stands, areas, invites and the roster, and read
 *   and write the club secret (radio key).
 * - Members edit only their own profile fields and may leave.
 * - Subscriptions: admins read; only the service writes. Stripe events, plans,
 *   map-pack writes and club create/delete are service-only.
 * - Harvests: the hunter's own always; the rest of the club only while shared;
 *   admins may remove shared ones (moderation).
 * - The service (trusted Lambdas) passes every rule, like Postgres' service_role.
 * - Anonymous callers may only list active plans.
 *
 * Keep-one-admin and seat limits are data rules enforced by conditional writes in
 * the repository, not here.
 */
import type { Member } from '@huntclub/shared';
import type { Actor } from './actor';
import { ClubDataError } from './errors';

/** The caller plus their membership of the club in question (if any). */
export interface Access {
  readonly actor: Actor;
  /** The caller's membership item for this club, active or not. */
  readonly membership: Member | undefined;
  readonly now: Date;
}

/** A membership counts until its guest pass expires. */
export function isActiveMembership(member: Pick<Member, 'expiresAt'>, now: Date): boolean {
  return member.expiresAt === undefined || Date.parse(member.expiresAt) > now.getTime();
}

const activeMember = (a: Access) =>
  a.membership !== undefined && isActiveMembership(a.membership, a.now);
const activeAdmin = (a: Access) => activeMember(a) && a.membership?.role === 'admin';
/** The caller is this active member (their own profile, harvest, …). */
const isSelf = (a: Access, userId: string) => activeMember(a) && a.membership?.userId === userId;

type Rule<R> = (access: Access, resource: R) => boolean;
const never = (_access: Access) => false;

/** Owner-of-a-harvest style resources. */
interface Owned {
  readonly userId: string;
}
interface SharedOwned extends Owned {
  readonly shared: boolean;
}

/** Every user-facing rule. The service bypasses all of them. */
export const POLICIES = {
  readClub: activeMember,
  updateClub: activeAdmin,
  createClub: never,
  deleteClub: never,

  readClubSecret: activeAdmin,
  writeClubSecret: activeAdmin,

  readRoster: activeMember,
  addMember: activeAdmin,
  /** Role and guest-pass expiry. */
  setMemberAccess: activeAdmin,
  editMemberProfile: ((a, target: Owned) =>
    activeAdmin(a) || isSelf(a, target.userId)) as Rule<Owned>,
  removeMember: ((a, target: Owned) => activeAdmin(a) || isSelf(a, target.userId)) as Rule<Owned>,

  manageInvites: activeAdmin,

  readPlaces: activeMember,
  writePlaces: activeAdmin,

  readMapPacks: activeMember,
  writeMapPacks: never,

  readSubscription: activeAdmin,
  /** Start a Stripe Checkout for the club. */
  manageBilling: activeAdmin,
  /** Subscriptions, Stripe events and plans. */
  writeBilling: never,
  readStripeEvents: never,

  readHarvest: ((a, h: SharedOwned) =>
    isSelf(a, h.userId) || (h.shared && activeMember(a))) as Rule<SharedOwned>,
  /** Log or edit: only as yourself, while a member. */
  writeOwnHarvest: ((a, h: Owned) => isSelf(a, h.userId)) as Rule<Owned>,
  deleteHarvest: ((a, h: SharedOwned) =>
    isSelf(a, h.userId) || (h.shared && activeAdmin(a))) as Rule<SharedOwned>,
} satisfies Record<string, Rule<never>>;

export type Policy = keyof typeof POLICIES;
type ResourceOf<P extends Policy> = Parameters<(typeof POLICIES)[P]>[1];
/** Policies about the club as a whole (no resource argument). */
export type ResourcelessPolicy = {
  [P in Policy]: ResourceOf<P> extends undefined ? P : never;
}[Policy];

/** True if the access passes the policy (service always does; anonymous never). */
export function can<P extends Policy>(
  access: Access,
  policy: P,
  ...resource: ResourceOf<P> extends undefined ? [] : [ResourceOf<P>]
): boolean {
  if (access.actor.kind === 'service') return true;
  if (access.actor.kind === 'anonymous') return false;
  const rule = POLICIES[policy] as Rule<unknown>;
  return rule(access, resource[0]);
}

/** Like `can`, but throws not_authenticated (anonymous) or forbidden. */
export function authorize<P extends Policy>(
  access: Access,
  policy: P,
  ...resource: ResourceOf<P> extends undefined ? [] : [ResourceOf<P>]
): void {
  if (can(access, policy, ...resource)) return;
  throw new ClubDataError(access.actor.kind === 'anonymous' ? 'not_authenticated' : 'forbidden');
}

/** The signed-in user's id, or not_authenticated (service and anonymous have none). */
export function requireUser(actor: Actor): string {
  if (actor.kind !== 'user') throw new ClubDataError('not_authenticated');
  return actor.userId;
}
