import {
  CLUB_PRICING,
  DAY_MS,
  ENTITLEMENT_GRACE_DAYS,
  SUBSCRIPTION_STATUS_LABELS,
  type Subscription,
} from '@huntclub/shared';
import { screen, within } from '@testing-library/react';
import { formatDate } from '../format';
import { MESH_STAYS_FREE, NO_INVOICES, SUBSCRIPTION_STRIP } from '../pages/Billing';
import { renderSignedIn } from '../testing/app';
import { sampleData } from '../testing/fakeClubApi';
import { statCells } from '../testing/stats';

const iso = (ms: number) => new Date(ms).toISOString();

/** Billing over the sample club with its subscription changed (null: none yet). */
async function billing(change: Partial<Subscription> | null, data = sampleData()) {
  const subscription = change === null ? null : { ...data.subscription!, ...change };
  const view = await renderSignedIn({ ...data, subscription }, '#/billing');
  await screen.findByRole('heading', { level: 1, name: 'Billing' });
  await screen.findByText(MESH_STAYS_FREE);
  // The page has loaded once the subscription (or the offer) shows.
  await screen.findAllByText(/Status|No subscription yet\.|Payments are not open yet\./);
  return view;
}

/** The subscription strip's cells as "Label value". */
const cells = () => statCells(SUBSCRIPTION_STRIP);

/** A banner's title (the strip may say the same word in its Status cell). */
const bannerTitle = (title: string) =>
  screen.getAllByText(title).find((el) => el.classList.contains('ui-banner__title'));

const cta = () => screen.queryByRole('button', { name: CLUB_PRICING.cta });
const manage = () => screen.queryByRole('button', { name: 'Manage subscription' });

/** The grace period line under Status, which only a past-due payment shows. */
const grace = () =>
  [...document.querySelectorAll('.ui-stat-tile__hint')].find((e) =>
    /grace period/i.test(e.textContent ?? ''),
  ) ?? null;

describe('Billing states', () => {
  it('active: three cells (status, plan name and price, renewal), with Manage and no payment form', async () => {
    await billing({ interval: 'year' });
    const yearly = CLUB_PRICING.intervals.year;
    expect(await cells()).toEqual([
      'StatusActive',
      `Plan${yearly.price}Club plan, billed yearly`,
      'Renews onAugust 1, 2027',
    ]);
    expect(screen.queryAllByText(/grace period/i)).toHaveLength(0);
    expect(manage()).toBeTruthy();
    expect(cta()).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('trial ending soon: a warning with the days left', async () => {
    await billing({ status: 'trialing', paidThrough: iso(Date.now() + 2 * DAY_MS) });
    expect(bannerTitle('The free trial ends in 2 days')).toBeTruthy();
    expect((await cells())[0]).toBe('StatusEnding');
    expect((await cells())[2]).toMatch(/^Free trial ends/);
    expect(grace()).toBeNull();
    expect(cta()).toBeNull();
  });

  it('set not to renew: when it ends', async () => {
    await billing({ cancelAtPeriodEnd: true });
    expect(bannerTitle('Set not to renew')).toBeTruthy();
    expect(await cells()).toContain('Ends onAugust 1, 2027');
    expect(grace()).toBeNull();
  });

  it('payment overdue: the grace period under Status, and Manage only', async () => {
    const paidThrough = Date.now() - 2 * DAY_MS;
    await billing({ status: 'past_due', paidThrough: iso(paidThrough) });
    expect(bannerTitle(SUBSCRIPTION_STATUS_LABELS.past_due)).toBeTruthy();
    expect(screen.getByText(/Update the card under Manage subscription/)).toBeTruthy();
    const until = formatDate(iso(paidThrough + ENTITLEMENT_GRACE_DAYS * DAY_MS));
    const line = grace()!;
    expect(line.textContent).toBe(
      `Grace period: club features stay on until ${until}, ${ENTITLEMENT_GRACE_DAYS} days after the paid period.`,
    );
    expect((await cells())[0]).toBe(
      `Status${SUBSCRIPTION_STATUS_LABELS.past_due}${line.textContent}`,
    );
    expect(await cells()).toHaveLength(3);
    expect((await cells())[2]).toMatch(/^Payment was due/);
    expect(manage()).toBeTruthy();
    expect(cta()).toBeNull();
  });

  it('canceled: says club features need a subscription and offers the trial again', async () => {
    await billing({ status: 'canceled', paidThrough: iso(Date.now() - 20 * DAY_MS) });
    expect(bannerTitle(SUBSCRIPTION_STATUS_LABELS.canceled)).toBeTruthy();
    expect(screen.getByText(/Club features need a subscription/)).toBeTruthy();
    expect(cta()).toBeTruthy();
  });

  it('none yet: the trial, with no Manage', async () => {
    await billing(null);
    expect(screen.getByText('No subscription yet.')).toBeTruthy();
    expect(cta()).toBeTruthy();
    expect(manage()).toBeNull();
  });

  it('no plans on sale: says payments are not open', async () => {
    await billing(null, { ...sampleData(), plans: [] });
    expect(screen.getByText('Payments are not open yet.')).toBeTruthy();
    expect(cta()).toBeNull();
  });

  it('payment overdue past the grace period: says club features are off', async () => {
    await billing({ status: 'past_due', paidThrough: iso(Date.now() - 30 * DAY_MS) });
    expect(grace()!.textContent).toBe('The grace period is over: club features are off.');
    expect(screen.getByText(/Club features are off until a payment goes through/)).toBeTruthy();
  });

  it('lists invoices, with an empty state until payments are set up', async () => {
    for (const change of [{}, { status: 'past_due' as const }, null]) {
      const view = await billing(change);
      const section = screen
        .getByRole('heading', { level: 2, name: 'Invoices' })
        .closest('section')!;
      expect(
        within(section).getByRole('heading', { level: 3, name: NO_INVOICES.title }),
      ).toBeTruthy();
      expect(within(section).getByText(NO_INVOICES.line)).toBeTruthy();
      expect(section.querySelector('.ui-empty__icon svg')).toBeTruthy();
      view.unmount();
    }
  });

  it('every state says the mesh keeps working', async () => {
    for (const change of [{}, { status: 'past_due' as const }, null]) {
      const view = await billing(change);
      expect(screen.getByText(MESH_STAYS_FREE)).toBeTruthy();
      view.unmount();
    }
  });
});
