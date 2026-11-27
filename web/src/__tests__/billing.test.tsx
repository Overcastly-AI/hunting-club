import {
  CLUB_PRICING,
  DAY_MS,
  SUBSCRIPTION_STATUS_LABELS,
  type Subscription,
} from '@huntclub/shared';
import { screen, within } from '@testing-library/react';
import { MESH_STAYS_FREE } from '../pages/Billing';
import { renderSignedIn } from '../testing/app';
import { sampleData } from '../testing/fakeClubApi';

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
const cells = async () =>
  within(await screen.findByRole('list', { name: 'Subscription' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent);

/** A banner's title (the strip may say the same word in its Status cell). */
const bannerTitle = (title: string) =>
  screen.getAllByText(title).find((el) => el.classList.contains('ui-banner__title'));

const cta = () => screen.queryByRole('button', { name: CLUB_PRICING.cta });
const manage = () => screen.queryByRole('button', { name: 'Manage subscription' });

describe('Billing states', () => {
  it('active: plan, status and renewal, with Manage and no payment form', async () => {
    await billing({ interval: 'year' });
    expect(await cells()).toEqual([
      'StatusActive',
      'PlanYearly · $100/year',
      'Renews onAugust 1, 2027',
      'Club features untilAugust 15, 2027',
    ]);
    expect(manage()).toBeTruthy();
    expect(cta()).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('trial ending soon: a warning with the days left', async () => {
    await billing({ status: 'trialing', paidThrough: iso(Date.now() + 2 * DAY_MS) });
    expect(bannerTitle('The free trial ends in 2 days')).toBeTruthy();
    expect((await cells())[0]).toBe('StatusEnding');
    expect((await cells())[1]).toMatch(/^Free trial ends/);
    expect(cta()).toBeNull();
  });

  it('set not to renew: when it ends', async () => {
    await billing({ cancelAtPeriodEnd: true });
    expect(bannerTitle('Set not to renew')).toBeTruthy();
    expect(await cells()).toContain('Ends onAugust 1, 2027');
  });

  it('payment overdue: says until when club features stay on, and offers Manage only', async () => {
    await billing({ status: 'past_due', paidThrough: iso(Date.now() - 2 * DAY_MS) });
    expect(bannerTitle(SUBSCRIPTION_STATUS_LABELS.past_due)).toBeTruthy();
    expect(screen.getByText(/Club features stay on until .*Update the card/)).toBeTruthy();
    expect((await cells())[0]).toBe(`Status${SUBSCRIPTION_STATUS_LABELS.past_due}`);
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

  it('every state says the mesh keeps working', async () => {
    for (const change of [{}, { status: 'past_due' as const }, null]) {
      const view = await billing(change);
      expect(screen.getByText(MESH_STAYS_FREE)).toBeTruthy();
      view.unmount();
    }
  });
});
