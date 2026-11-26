// Stripe webhook end to end: Stripe's own signature code (stripe-node, no network) →
// thin event → re-fetch from a fake Stripe API → applyStripeEvent on DynamoDB Local.
import { randomUUID } from 'node:crypto';
import { SERVICE } from '@huntclub/club-data';
import { World } from '@huntclub/club-data/testing';
import Stripe from 'stripe';
import { STRIPE_METADATA, type StripeApi } from '../billing';
import { connectStripe } from '../clients';
import type { Handler } from '../http';
import { createStripeWebhook } from '../stripeWebhook';
import { urlEvent } from '../testing/requests';

const SECRET = 'whsec_test_secret';
const stripe = new Stripe('sk_test_dummy');
let w: World;
let webhook: Handler;

const subscriptions = new Map<string, Stripe.Subscription>();
const fakeApi = {
  retrieveSubscription: jest.fn(async (id: string) => {
    const sub = subscriptions.get(id);
    if (!sub) throw new Error('Stripe unavailable');
    return sub;
  }),
  retrieveCheckoutSession: jest.fn(async (id: string) => ({ id, subscription: `sub_for_${id}` })),
  retrieveInvoice: jest.fn(async (id: string) => ({
    id,
    parent: { subscription_details: { subscription: `sub_for_${id}` } },
  })),
} as unknown as StripeApi;

const oak = () => w.club('Oak Ridge');
const periodEnd = Math.floor(Date.parse('2027-08-01T00:00:00Z') / 1000);

function subscription(
  id: string,
  overrides: Partial<Stripe.Subscription> = {},
): Stripe.Subscription {
  return {
    id,
    customer: `cus_${oak()}`,
    status: 'active',
    trial_end: null,
    metadata: { [STRIPE_METADATA.clubId]: oak(), [STRIPE_METADATA.planId]: 'club_standard' },
    items: { data: [{ current_period_end: periodEnd }] },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

/** A thin event as Stripe would POST it, signed with the endpoint secret. */
function delivery(type: string, objectId: string, opts: { id?: string; secret?: string } = {}) {
  const payload = JSON.stringify({
    id: opts.id ?? `evt_test_${randomUUID().replaceAll('-', '')}`,
    object: 'v2.core.event',
    type,
    created: new Date().toISOString(),
    livemode: false,
    related_object: { id: objectId, type: 'subscription', url: `/v1/x/${objectId}` },
  });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: opts.secret ?? SECRET,
  });
  return urlEvent('POST', '/', { rawBody: payload, headers: { 'stripe-signature': signature } });
}

async function send(event: ReturnType<typeof delivery>) {
  const res = await webhook(event);
  return { status: res.statusCode, body: JSON.parse(res.body) as Record<string, unknown> };
}
const oakStatus = async () => (await w.data.getSubscription(SERVICE, oak()))?.status;

beforeAll(async () => {
  w = await World.seedTwoClubs();
  webhook = createStripeWebhook({
    data: w.data,
    verify: connectStripe('sk_test_dummy').verifier(SECRET),
    stripe: fakeApi,
  });
  // Oak Ridge's subscription as World created it (sub_<club>).
  subscriptions.set(`sub_${oak()}`, subscription(`sub_${oak()}`, { status: 'past_due' }));
});
afterAll(() => w.destroy());
beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));

it('rejects a bad signature with 400 before touching Stripe or the table', async () => {
  const res = await send(
    delivery('v1.customer.subscription.updated', `sub_${oak()}`, { secret: 'whsec_wrong' }),
  );
  expect(res.status).toBe(400);
  expect(fakeApi.retrieveSubscription).not.toHaveBeenCalled();
  expect(await oakStatus()).toBe('active');
});

it('rejects a body altered after signing', async () => {
  const event = delivery('v1.customer.subscription.updated', `sub_${oak()}`);
  const res = await webhook({ ...event, body: event.body!.replace('updated', 'deleted') });
  expect(res.statusCode).toBe(400);
});

it('re-fetches the subscription and applies its current state', async () => {
  const res = await send(
    delivery('v1.customer.subscription.updated', `sub_${oak()}`, { id: 'evt_test_once' }),
  );
  expect(res).toEqual({ status: 200, body: { received: true, outcome: 'applied' } });
  expect(await w.data.getSubscription(SERVICE, oak())).toMatchObject({
    status: 'past_due',
    paidThrough: '2027-08-01T00:00:00.000Z',
  });
  expect(await w.data.getStripeEvent(SERVICE, 'evt_test_once')).toBeDefined();
});

it('acknowledges a redelivered event without applying it again', async () => {
  subscriptions.set(`sub_${oak()}`, subscription(`sub_${oak()}`, { status: 'canceled' }));
  const res = await send(
    delivery('v1.customer.subscription.updated', `sub_${oak()}`, { id: 'evt_test_once' }),
  );
  expect(res.body).toMatchObject({ outcome: 'duplicate' });
  expect(await oakStatus()).toBe('past_due');
});

it('follows checkout.session.completed and invoice.paid to their subscription', async () => {
  subscriptions.set(`sub_for_cs_1`, subscription(`sub_${oak()}`, { status: 'active' }));
  expect((await send(delivery('v1.checkout.session.completed', 'cs_1'))).body).toMatchObject({
    outcome: 'applied',
  });
  expect(await oakStatus()).toBe('active');

  subscriptions.set(
    `sub_for_in_1`,
    subscription(`sub_${oak()}`, { status: 'trialing', trial_end: periodEnd }),
  );
  expect((await send(delivery('v1.invoice.paid', 'in_1'))).body).toMatchObject({
    outcome: 'applied',
  });
  expect(await oakStatus()).toBe('trialing');
});

it('ignores event types it does not handle, and subscriptions that are not a club', async () => {
  expect((await send(delivery('v1.customer.created', 'cus_1'))).body).toMatchObject({
    outcome: 'ignored',
  });
  subscriptions.set('sub_other', subscription('sub_other', { metadata: {} }));
  expect(
    (await send(delivery('v1.customer.subscription.updated', 'sub_other'))).body,
  ).toMatchObject({
    outcome: 'ignored',
  });
});

it('answers 500 when Stripe fails, records nothing, and succeeds on the retry', async () => {
  const event = delivery('v1.customer.subscription.updated', 'sub_later', { id: 'evt_test_retry' });
  expect((await send(event)).status).toBe(500);
  expect(await w.data.getStripeEvent(SERVICE, 'evt_test_retry')).toBeUndefined();
  subscriptions.set('sub_later', subscription(`sub_${oak()}`));
  expect((await send(event)).body).toMatchObject({ outcome: 'applied' });
});

it('acknowledges but rejects a subscription that belongs to another club', async () => {
  subscriptions.set(
    'sub_moved',
    subscription(`sub_${oak()}`, {
      metadata: {
        [STRIPE_METADATA.clubId]: w.club('Pine Hollow'),
        [STRIPE_METADATA.planId]: 'club_standard',
      },
    }),
  );
  const res = await send(delivery('v1.customer.subscription.updated', 'sub_moved'));
  expect(res).toEqual({
    status: 200,
    body: { received: true, outcome: 'rejected', code: 'conflict' },
  });
});

it('only accepts POST', async () => {
  expect((await webhook(urlEvent('GET', '/'))).statusCode).toBe(405);
});
