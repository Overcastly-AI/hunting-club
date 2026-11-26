import { BILLING_INTERVALS, CLUB_PRICING, type PlanPut } from '@huntclub/shared';

/** Each plan's price per billing interval, from the one pricing source. */
const CLUB_PRICES = Object.fromEntries(
  BILLING_INTERVALS.map((interval) => [interval, CLUB_PRICING.intervals[interval].amountCents]),
);

/**
 * The club plans. Prices are the owner's (CLUB_PRICING, monthly and yearly). The
 * member limit is still a PLACEHOLDER: an OPEN DECISION in docs/SPEC.md ("Club member
 * limits per plan"); 50 stands in until the owner decides. Written to the table by
 * `seedPlans` (deploy-time / provisioning Lambda).
 */
export const PLACEHOLDER_PLANS: readonly PlanPut[] = [
  {
    id: 'club_standard',
    name: 'Club',
    memberLimit: 50,
    prices: CLUB_PRICES,
    active: true,
  },
];
