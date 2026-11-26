/**
 * Club subscription pricing (owner decision, 2026-11-26): the one source for the
 * marketing site, the web Billing page, the plan records and Checkout's trial.
 * Amounts are USD cents; display strings are derived, never retyped.
 */
export const BILLING_INTERVALS = ['year', 'month'] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

const TRIAL_DAYS = 14;
const YEAR_CENTS = 10_000;
const MONTH_CENTS = 1_000;

/** "$100" from 10000 (whole dollars when exact). */
export function formatUsd(cents: number): string {
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
}

/** Months a yearly price saves against paying monthly for twelve months. */
const MONTHS_FREE = (12 * MONTH_CENTS - YEAR_CENTS) / MONTH_CENTS;

export interface IntervalPricing {
  amountCents: number;
  /** "Yearly" / "Monthly". */
  label: string;
  /** "$100/year". */
  price: string;
  /** Highlight shown next to the price ("2 months free"). */
  badge?: string;
}

export const CLUB_PRICING: {
  currency: 'usd';
  trialDays: number;
  defaultInterval: BillingInterval;
  intervals: Record<BillingInterval, IntervalPricing>;
  cta: string;
  terms: string;
} = {
  currency: 'usd',
  trialDays: TRIAL_DAYS,
  /** Pre-selected on the Billing page and the marketing site. */
  defaultInterval: 'year',
  intervals: {
    year: {
      amountCents: YEAR_CENTS,
      label: 'Yearly',
      price: `${formatUsd(YEAR_CENTS)}/year`,
      badge: `${MONTHS_FREE} months free`,
    },
    month: { amountCents: MONTH_CENTS, label: 'Monthly', price: `${formatUsd(MONTH_CENTS)}/month` },
  },
  /** Call to action for both intervals. */
  cta: `Start your ${TRIAL_DAYS}-day free trial`,
  /** The terms line under the call to action. */
  terms: `Then ${formatUsd(YEAR_CENTS)}/year or ${formatUsd(MONTH_CENTS)}/month. Cancel anytime before day ${TRIAL_DAYS} and you won't be charged.`,
};
