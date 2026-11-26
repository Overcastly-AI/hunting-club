import type { MemberRole, StandType, SubscriptionStatus } from '@huntclub/shared';

// Plain-language labels for shared domain values. Mixed case, no jargon.

export const ROLE_LABELS: Record<MemberRole, string> = {
  admin: 'Admin',
  member: 'Member',
  guest: 'Guest',
};

export const STAND_TYPE_LABELS: Record<StandType, string> = {
  tree_stand: 'Tree stand',
  ladder: 'Ladder',
  ground_blind: 'Ground blind',
};

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

/** "August 1, 2027" from an ISO date. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
