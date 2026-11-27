import type { Subscription } from '@huntclub/shared';
import type { Status } from './components/ui';

/** A free trial "is ending" (warning dot on Billing) within this many days of its end. */
export const TRIAL_ENDING_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/** While trialing, paidThrough is the trial's end. */
const trialEnding = (sub: Subscription, now: number) =>
  sub.status === 'trialing' &&
  sub.paidThrough !== undefined &&
  Date.parse(sub.paidThrough) - now <= TRIAL_ENDING_DAYS * DAY_MS;

/** The club's status pill beside its name: Trial, Ending, Active or Past due; none otherwise. */
export function clubStatus(sub: Subscription | null, now = Date.now()): Status | undefined {
  if (!sub) return undefined;
  switch (sub.status) {
    case 'trialing':
      return trialEnding(sub, now) ? 'ending' : 'trial';
    case 'active':
      return sub.cancelAtPeriodEnd ? 'ending' : 'active';
    case 'past_due':
    case 'unpaid':
      return 'pastDue';
    default:
      return undefined;
  }
}

/** Why Billing carries a warning dot in the nav: payment past due or the trial ending. */
export type BillingAlert = 'pastDue' | 'trialEnding';

export const BILLING_ALERT_LABELS: Record<BillingAlert, string> = {
  pastDue: 'Payment past due',
  trialEnding: 'Free trial ending',
};

export function billingAlert(sub: Subscription | null, now = Date.now()): BillingAlert | undefined {
  if (!sub) return undefined;
  if (sub.status === 'past_due' || sub.status === 'unpaid') return 'pastDue';
  return trialEnding(sub, now) ? 'trialEnding' : undefined;
}
