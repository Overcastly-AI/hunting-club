// Domain enums: the single source of truth for every value list the app, web admin,
// Lambdas and club-data store or send. Hand-written; nothing generates these.
// Values are stored in DynamoDB and sent over the API, so never rename one.
import { z } from 'zod';

export const MEMBER_ROLES = ['admin', 'member', 'guest'] as const;
export const MemberRoleSchema = z.enum(MEMBER_ROLES);
export type MemberRole = z.infer<typeof MemberRoleSchema>;

/** Roles an invite may grant (never admin: admins are promoted by another admin). */
export const InviteRoleSchema = MemberRoleSchema.exclude(['admin']);
export type InviteRole = z.infer<typeof InviteRoleSchema>;
export const INVITE_ROLES = InviteRoleSchema.options;

/** Each role in plain words, for the app and the club admin. Display only. */
export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  admin: 'Admin',
  member: 'Member',
  guest: 'Guest',
};

export const STAND_TYPES = ['tree_stand', 'ladder', 'ground_blind'] as const;
export const StandTypeSchema = z.enum(STAND_TYPES);
export type StandType = z.infer<typeof StandTypeSchema>;

/**
 * Lucide icon (PascalCase export name) for each stand type, the same in the app
 * (lucide-react-native) and the club admin (lucide-react). Display only.
 */
export const STAND_TYPE_ICON_NAMES = {
  tree_stand: 'TreePine',
  ladder: 'ArrowUpFromLine',
  ground_blind: 'Tent',
} as const satisfies Record<StandType, string>;
export type StandTypeIconName = (typeof STAND_TYPE_ICON_NAMES)[StandType];

/** Words shown and read aloud for each stand type, in the app and the club admin. */
export const STAND_TYPE_LABELS: Record<StandType, string> = {
  tree_stand: 'Tree stand',
  ladder: 'Ladder stand',
  ground_blind: 'Ground blind',
};

/** Harvest sex keys. Their wire codes live in @huntclub/mesh (HARVEST_SEX_CODES). */
export const HARVEST_SEXES = ['male', 'female', 'unknown'] as const;
export const HarvestSexSchema = z.enum(HARVEST_SEXES);
export type HarvestSex = z.infer<typeof HarvestSexSchema>;

/** Mirrors Stripe's subscription.status values; written only by the webhook Lambda. */
export const SUBSCRIPTION_STATUSES = [
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'unpaid',
  'canceled',
  'paused',
] as const;
export const SubscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUSES);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

/** Each subscription status in plain words (Billing, My club and Needs you). */
export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  incomplete: 'Payment not finished',
  incomplete_expired: 'Payment expired',
  trialing: 'Trial',
  active: 'Active',
  past_due: 'Payment overdue',
  unpaid: 'Unpaid',
  canceled: 'Canceled',
  paused: 'Paused',
};

/**
 * The one definition of which subscription statuses keep club features unlocked.
 * past_due is the grace period before cancellation (SPEC "When a subscription lapses").
 */
export const ENTITLED_SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
] as const satisfies readonly SubscriptionStatus[];

export function isEntitledStatus(status: SubscriptionStatus): boolean {
  return (ENTITLED_SUBSCRIPTION_STATUSES as readonly SubscriptionStatus[]).includes(status);
}

/** Reasons an invite redemption is refused. */
export const REDEEM_INVITE_ERRORS = [
  'not_authenticated',
  'invite_not_found',
  'invite_expired',
  'invite_used_up',
  'club_inactive',
  'club_full',
] as const;
export type RedeemInviteError = (typeof REDEEM_INVITE_ERRORS)[number];

/**
 * Every error code the club API returns (the `code` of a club-data error). Clients
 * switch on these to show a message; HTTP status mapping lives with the Lambda API.
 */
export const CLUB_API_ERRORS = [
  ...REDEEM_INVITE_ERRORS,
  'forbidden',
  'not_found',
  'conflict',
  'invalid',
  'last_admin',
  /** A deployment setting (e.g. a plan's Stripe price) isn't configured yet. */
  'not_configured',
  /** Unexpected server failure; details are only in the server log. */
  'internal',
] as const;
export type ClubApiError = (typeof CLUB_API_ERRORS)[number];
