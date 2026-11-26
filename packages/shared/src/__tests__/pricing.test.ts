import { BILLING_INTERVALS, CLUB_PRICING, formatUsd } from '../pricing';
import { CheckoutRequestSchema, StripePricesSchema } from '../api';

describe('club pricing (owner decision)', () => {
  it('is $10 a month or $100 a year, yearly by default, with a 14-day trial', () => {
    expect(CLUB_PRICING.currency).toBe('usd');
    expect(CLUB_PRICING.trialDays).toBe(14);
    expect(CLUB_PRICING.defaultInterval).toBe('year');
    expect(CLUB_PRICING.intervals.month).toMatchObject({ amountCents: 1000, price: '$10/month' });
    expect(CLUB_PRICING.intervals.year).toMatchObject({
      amountCents: 10000,
      price: '$100/year',
      badge: '2 months free',
      savings: 'save $20',
    });
  });

  it('gives each interval its own free-trial line', () => {
    expect(CLUB_PRICING.intervals.month.trial).toBe(
      "14-day free trial, then $10/month. Cancel anytime before day 14 and you won't be charged.",
    );
    expect(CLUB_PRICING.intervals.year.trial).toBe(
      "14-day free trial, then $100/year. Cancel anytime before day 14 and you won't be charged.",
    );
  });

  it('derives the call to action and the terms line', () => {
    expect(CLUB_PRICING.cta).toBe('Start your 14-day free trial');
    expect(CLUB_PRICING.terms).toBe(
      "Then $100/year or $10/month. Cancel anytime before day 14 and you won't be charged.",
    );
  });

  it('formats cents as dollars', () => {
    expect(formatUsd(10000)).toBe('$100');
    expect(formatUsd(1250)).toBe('$12.50');
  });

  it('defaults Checkout to the yearly price and accepts only known intervals', () => {
    expect(CheckoutRequestSchema.parse({ planId: 'club_standard' }).interval).toBe('year');
    expect(
      CheckoutRequestSchema.safeParse({ planId: 'club_standard', interval: 'week' }).success,
    ).toBe(false);
    expect(BILLING_INTERVALS).toEqual(['year', 'month']);
  });

  it('reads the Stripe price map per plan and interval', () => {
    expect(StripePricesSchema.parse({})).toEqual({});
    expect(StripePricesSchema.parse({ club_standard: { month: 'price_1' } })).toEqual({
      club_standard: { month: 'price_1' },
    });
    expect(StripePricesSchema.safeParse({ club_standard: 'price_1' }).success).toBe(false);
  });
});
