/**
 * Club subscription pricing (owner decision, 2026-11-26): the one source for the
 * marketing site, the web Billing page, the plan records and Checkout's trial.
 * Amounts are USD cents; display strings are derived, never retyped.
 */
/**
 * Maximum people in a free hunting party, including the person who started it (docs/SPEC.md
 * "Free vs Club"). The app enforces it (@huntclub/core party rules); the site and the
 * legal copy state it.
 */
export const FREE_PARTY_MAX_MEMBERS = 3;

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

/** Cents a yearly price saves against paying monthly for twelve months. */
const YEAR_SAVES_CENTS = 12 * MONTH_CENTS - YEAR_CENTS;
/** The same saving in months. */
const MONTHS_FREE = YEAR_SAVES_CENTS / MONTH_CENTS;

/** "14-day free trial, then $10/month. Cancel anytime before day 14 …" for one interval. */
const trialLine = (price: string) =>
  `${TRIAL_DAYS}-day free trial, then ${price}. Cancel anytime before day ${TRIAL_DAYS} and you won't be charged.`;

export interface IntervalPricing {
  amountCents: number;
  /** "Yearly" / "Monthly". */
  label: string;
  /** "$100/year". */
  price: string;
  /** Highlight shown next to the price ("2 months free"). */
  badge?: string;
  /** What this interval saves against monthly ("save $20"). */
  savings?: string;
  /** The free-trial line under this interval's price. */
  trial: string;
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
      savings: `save ${formatUsd(YEAR_SAVES_CENTS)}`,
      trial: trialLine(`${formatUsd(YEAR_CENTS)}/year`),
    },
    month: {
      amountCents: MONTH_CENTS,
      label: 'Monthly',
      price: `${formatUsd(MONTH_CENTS)}/month`,
      trial: trialLine(`${formatUsd(MONTH_CENTS)}/month`),
    },
  },
  /** Call to action for both intervals. */
  cta: `Start your ${TRIAL_DAYS}-day free trial`,
  /** The terms line under the call to action. */
  terms: `Then ${formatUsd(YEAR_CENTS)}/year or ${formatUsd(MONTH_CENTS)}/month. Cancel anytime before day ${TRIAL_DAYS} and you won't be charged.`,
};
