import { CLUB_API_ERRORS } from '@huntclub/shared';
import type Stripe from 'stripe';
import { STRIPE_METADATA, subscriptionState } from '../billing';
import { ERROR_STATUS } from '../errors';
import { matchRoute, type Route } from '../router';

describe('router', () => {
  const routes: Route<null>[] = [
    { method: 'GET', path: '/clubs/:clubId', handle: async () => 'club' },
    { method: 'GET', path: '/plans', handle: async () => 'plans' },
  ];
  const id = '00000000-0000-4000-8000-000000000001';

  it('matches paths and extracts UUID params (trailing slash allowed)', () => {
    expect(matchRoute(routes, 'GET', `/clubs/${id}/`)).toMatchObject({ params: { clubId: id } });
  });

  it('never matches a non-UUID param (no key injection into the table)', () => {
    expect(matchRoute(routes, 'GET', '/clubs/x#MEMBER#y').route).toBeUndefined();
  });

  it('tells a wrong method from an unknown path', () => {
    expect(matchRoute(routes, 'POST', '/plans')).toEqual({ methodNotAllowed: true });
    expect(matchRoute(routes, 'GET', '/nope')).toEqual({ methodNotAllowed: false });
  });
});

describe('errors', () => {
  it('every API error code has a 4xx/5xx status', () => {
    for (const code of CLUB_API_ERRORS) expect(ERROR_STATUS[code]).toBeGreaterThanOrEqual(400);
  });
});

describe('subscriptionState', () => {
  const base = {
    id: 'sub_1',
    customer: { id: 'cus_1' },
    status: 'active',
    trial_end: null,
    metadata: { [STRIPE_METADATA.clubId]: 'club', [STRIPE_METADATA.planId]: 'club_standard' },
    items: { data: [{ current_period_end: 100 }, { current_period_end: 200 }] },
  };
  const state = (o: object) =>
    subscriptionState({ ...base, ...o } as unknown as Stripe.Subscription);

  it('uses the latest item period end as paid-through', () => {
    expect(state({})).toMatchObject({
      stripeCustomerId: 'cus_1',
      paidThrough: new Date(200_000).toISOString(),
    });
  });

  it('uses the trial end while trialing', () => {
    expect(state({ status: 'trialing', trial_end: 300 })?.paidThrough).toBe(
      new Date(300_000).toISOString(),
    );
  });

  it('ignores subscriptions without our club metadata', () => {
    expect(state({ metadata: {} })).toBeUndefined();
  });
});
