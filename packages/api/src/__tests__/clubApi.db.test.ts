// Club API handler end to end: Function URL event → JWT check → routes → club-data on
// DynamoDB Local. Permission rules themselves are covered in club-data's tests; these
// check the HTTP contract (status codes, error shape, auth, body validation).
import { POLYGON, World, expectCode, keyOf } from '@huntclub/club-data/testing';
import { SERVICE } from '@huntclub/club-data';
import { CLUB_PRICING, type MapPack, type MapPackRequestResponse } from '@huntclub/shared';
import { cognitoVerifier } from '../auth';
import type { StripeApi } from '../billing';
import { createClubApi } from '../clubApi';
import type { Handler } from '../http';
import { TEST_POOL, TestUserPool } from '../testing/jwt';
import { urlEvent } from '../testing/requests';

let w: World;
let api: Handler;
const pool = new TestUserPool();
const startMapPackBuild = jest.fn(async (_build: unknown) => undefined);
let ids = 0;
const createCheckoutSession = jest.fn(async () => ({ url: 'https://checkout.stripe.test/s' }));
const createPortalSession = jest.fn(async () => ({ url: 'https://billing.stripe.test/p' }));
const fakeStripe = { createCheckoutSession, createPortalSession } as unknown as StripeApi;
const PRICES = { club_standard: { year: 'price_test_year', month: 'price_test_month' } };
const PORTAL_RETURN = 'https://web.test/app/#/billing';

const makeApi = (prices: Record<string, Record<string, string>>) =>
  createClubApi({
    data: w.data,
    verifier: cognitoVerifier(TEST_POOL, pool.jwks),
    stripe: async () => fakeStripe,
    startMapPackBuild,
    newId: () => `00000000-0000-4000-8000-${(++ids).toString(16).padStart(12, '0')}`,
    checkout: {
      prices,
      successUrl: 'https://web.test/checkout/done',
      cancelUrl: 'https://web.test/checkout/cancel',
      portalReturnUrl: PORTAL_RETURN,
    },
  });

beforeAll(async () => {
  w = await World.seedTwoClubs();
  api = makeApi(PRICES);
});
afterAll(() => w.destroy());
beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));

const oak = () => w.club('Oak Ridge');
async function call(
  method: string,
  path: string,
  opts: { as?: string; body?: unknown; token?: string; rawBody?: string; via?: Handler } = {},
) {
  const token = opts.token ?? (opts.as ? pool.accessToken(w.user(opts.as)) : undefined);
  const res = await (opts.via ?? api)(
    urlEvent(method, path, {
      ...(opts.body !== undefined ? { body: opts.body } : {}),
      ...(opts.rawBody !== undefined ? { rawBody: opts.rawBody } : {}),
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  );
  return { status: res.statusCode, body: res.body ? (JSON.parse(res.body) as any) : undefined };
}

describe('authentication', () => {
  it('lists plans without a token', async () => {
    const res = await call('GET', '/plans');
    expect(res.status).toBe(200);
    expect(res.body.map((p: { id: string }) => p.id)).toEqual(['club_standard']);
  });

  it('rejects a missing, forged, expired, ID or foreign-client token with 401', async () => {
    const sub = w.user('max');
    const bad = [
      undefined,
      pool.forgedToken(sub),
      pool.accessToken(sub, { exp: Math.floor(Date.now() / 1000) - 60 }),
      pool.accessToken(sub, { token_use: 'id' }),
      pool.accessToken(sub, { client_id: 'someoneelse' }),
      pool.accessToken(sub, { iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_Other' }),
    ];
    for (const token of bad) {
      const res = await call('GET', '/me/clubs', token ? { token } : {});
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: { code: 'not_authenticated', message: expect.any(String) },
      });
    }
  });

  it("maps a valid token's sub to the caller", async () => {
    const res = await call('GET', '/me/clubs', { as: 'max' });
    expect(res.status).toBe(200);
    expect(res.body.map((c: { club: { name: string } }) => c.club.name)).toEqual(['Oak Ridge']);
  });

  it('accepts the web client as well as the app client', async () => {
    const token = pool.accessToken(w.user('max'), { client_id: TEST_POOL.clientIds[1] });
    expect((await call('GET', '/me/clubs', { token })).status).toBe(200);
  });
});

describe('routing and errors', () => {
  it('answers 404 for unknown routes and non-UUID ids', async () => {
    expect((await call('GET', '/nope', { as: 'max' })).status).toBe(404);
    expect((await call('GET', '/clubs/not-a-uuid', { as: 'max' })).status).toBe(404);
    expect((await call('GET', '/clubs/CLUB%23x', { as: 'max' })).status).toBe(404);
  });

  it('answers 405 for a known path with the wrong method', async () => {
    expect((await call('DELETE', '/me/clubs', { as: 'max' })).status).toBe(405);
  });

  it('rejects a body that is not JSON with 400 invalid', async () => {
    const res = await call('PATCH', `/clubs/${oak()}`, { as: 'ada', rawBody: '{nope' });
    expect(res).toMatchObject({ status: 400, body: { error: { code: 'invalid' } } });
  });

  it('returns 403 forbidden in the standard error shape', async () => {
    const res = await call('GET', `/clubs/${w.club('Pine Hollow')}`, { as: 'max' });
    expect(res).toEqual({
      status: 403,
      body: { error: { code: 'forbidden', message: 'forbidden' } },
    });
  });
});

describe('clubs and roster', () => {
  it('creates a club with the caller as first admin', async () => {
    const res = await call('POST', '/clubs', {
      as: 'cal',
      body: { club: { name: 'Cedar Camp' }, admin: { displayName: 'Cal', initials: 'CA' } },
    });
    expect(res.status).toBe(201);
    const members = await w.data.listMembers(SERVICE, res.body.id);
    expect(members).toEqual([expect.objectContaining({ userId: w.user('cal'), role: 'admin' })]);
  });

  it('a club made on the web can make an invite and read its radio key at once (UAT)', async () => {
    const created = await call('POST', '/clubs', {
      as: 'cal',
      body: { club: { name: 'Web Club' }, admin: { displayName: 'Cal', initials: 'CA' } },
    });
    const id = created.body.id;
    const secret = await call('GET', `/clubs/${id}/secret`, { as: 'cal' });
    expect(secret.status).toBe(200);
    expect(secret.body.keyVersion).toBe(1);
    const invite = await call('POST', `/clubs/${id}/invites`, {
      as: 'cal',
      body: { role: 'member', expiresAt: w.clock.inDays(7) },
    });
    expect(invite.status).toBe(201);
  });

  it('rejects a create body that names someone else as admin', async () => {
    const res = await call('POST', '/clubs', {
      as: 'cal',
      body: {
        club: { name: 'X' },
        admin: { displayName: 'X', initials: 'X', userId: w.user('max') },
      },
    });
    expect(res.status).toBe(400);
  });

  it('lets an admin update the club; validates the body', async () => {
    expect(
      (await call('PATCH', `/clubs/${oak()}`, { as: 'ada', body: { overdueGraceMinutes: 45 } }))
        .body,
    ).toMatchObject({ overdueGraceMinutes: 45 });
    expect(
      (await call('PATCH', `/clubs/${oak()}`, { as: 'ada', body: { overdueGraceMinutes: 9999 } }))
        .status,
    ).toBe(400);
  });

  it('roster: member edits own profile; promotions need an admin; keep one admin', async () => {
    const maxPath = `/clubs/${oak()}/members/${w.user('max')}`;
    expect(
      (await call('PATCH', maxPath, { as: 'max', body: { displayName: 'Maxine' } })).status,
    ).toBe(200);
    expect(
      (await call('PUT', `${maxPath}/access`, { as: 'max', body: { role: 'admin' } })).status,
    ).toBe(403);
    const adaAccess = `/clubs/${oak()}/members/${w.user('ada')}/access`;
    expect(await call('PUT', adaAccess, { as: 'ada', body: { role: 'member' } })).toMatchObject({
      status: 409,
      body: { error: { code: 'last_admin' } },
    });
    expect((await call('GET', `/clubs/${oak()}/members`, { as: 'gus' })).body).toHaveLength(4);
  });
});

describe('invites', () => {
  it('admin creates, lists and revokes; a user redeems', async () => {
    const created = await call('POST', `/clubs/${oak()}/invites`, {
      as: 'ada',
      body: { expiresAt: w.clock.inDays(7) },
    });
    expect(created.status).toBe(201);
    expect((await call('GET', `/clubs/${oak()}/invites`, { as: 'max' })).status).toBe(403);

    const joined = await call('POST', '/invites/redeem', {
      as: 'hal',
      body: { token: created.body.token, displayName: 'Hal', initials: 'HB' },
    });
    expect(joined).toMatchObject({ status: 200, body: { role: 'member', userId: w.user('hal') } });

    expect(
      (await call('DELETE', `/clubs/${oak()}/invites/${created.body.id}`, { as: 'ada' })).status,
    ).toBe(204);
    expect((await call('GET', `/clubs/${oak()}/invites`, { as: 'ada' })).body).toEqual([]);
  });

  it('maps redemption failures to their codes', async () => {
    const res = await call('POST', '/invites/redeem', {
      as: 'ivy',
      body: { token: 'f'.repeat(64), displayName: 'Ivy', initials: 'IV' },
    });
    expect(res).toMatchObject({ status: 404, body: { error: { code: 'invite_not_found' } } });
    expect(
      (await call('POST', '/invites/redeem', { as: 'ivy', body: { token: 'short' } })).status,
    ).toBe(400);
  });
});

describe('stands, areas and harvests', () => {
  it('admin creates a stand with a server-assigned mesh id; members read; clients cannot set it', async () => {
    const path = `/clubs/${oak()}/stands`;
    const stand = { name: 'Field Blind', type: 'ground_blind', lat: 40, lon: -90 };
    const created = await call('POST', path, { as: 'ada', body: stand });
    expect(created).toMatchObject({ status: 201, body: { meshId: 2 } });
    expect((await call('POST', path, { as: 'ada', body: { ...stand, meshId: 9 } })).status).toBe(
      400,
    );
    expect((await call('POST', path, { as: 'max', body: stand })).status).toBe(403);
    expect((await call('GET', path, { as: 'max' })).body).toHaveLength(2);
    expect(
      (await call('PATCH', `${path}/${created.body.id}`, { as: 'ada', body: { active: false } }))
        .body,
    ).toMatchObject({ active: false });
    expect((await call('DELETE', `${path}/${created.body.id}`, { as: 'ada' })).status).toBe(204);
  });

  it('areas and shared harvests', async () => {
    expect((await call('GET', `/clubs/${oak()}/areas`, { as: 'gus' })).body).toHaveLength(1);
    const logged = await call('POST', `/clubs/${oak()}/harvests`, {
      as: 'max',
      body: { species: 'whitetail', harvestedAt: w.clock.inDays(0) },
    });
    expect(logged).toMatchObject({ status: 201, body: { userId: w.user('max'), shared: true } });
    expect((await call('GET', `/clubs/${oak()}/harvests`, { as: 'gus' })).body).toHaveLength(1);
  });
});

describe('club secret', () => {
  it('admins read it as base64; members cannot', async () => {
    const res = await call('GET', `/clubs/${oak()}/secret`, { as: 'ada' });
    expect(res.body).toMatchObject({
      channelKey: Buffer.from(keyOf('ab')).toString('base64'),
      keyVersion: 2, // the seed resets the key the club was created with
    });
    expect((await call('GET', `/clubs/${oak()}/secret`, { as: 'max' })).status).toBe(403);
  });

  it('admins rotate it; a wrong-length key is rejected', async () => {
    const channelKey = Buffer.from(keyOf('ef')).toString('base64');
    const res = await call('PUT', `/clubs/${oak()}/secret`, { as: 'ada', body: { channelKey } });
    expect(res.body).toMatchObject({ channelKey, keyVersion: 3 });
    const short = Buffer.alloc(16).toString('base64');
    expect(
      (await call('PUT', `/clubs/${oak()}/secret`, { as: 'ada', body: { channelKey: short } }))
        .status,
    ).toBe(400);
  });
});

describe('billing', () => {
  it('admins read the subscription status', async () => {
    expect((await call('GET', `/clubs/${oak()}/subscription`, { as: 'ada' })).body).toMatchObject({
      subscription: { status: 'active' },
    });
    expect((await call('GET', `/clubs/${oak()}/subscription`, { as: 'max' })).status).toBe(403);
  });

  it('a club with no subscription yet answers 200 { subscription: null }', async () => {
    const created = await call('POST', '/clubs', {
      as: 'nora',
      body: { club: { name: 'Fresh Club' }, admin: { displayName: 'Nora', initials: 'NO' } },
    });
    const res = await call('GET', `/clubs/${created.body.id}/subscription`, { as: 'nora' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ subscription: null });
  });

  it('any member reads the entitlement; outsiders cannot', async () => {
    const res = await call('GET', `/clubs/${oak()}/entitlement`, { as: 'gus' });
    expect(res.body).toMatchObject({
      clubId: oak(),
      status: 'active',
      featuresUntil: expect.any(String),
    });
    expect((await call('GET', `/clubs/${oak()}/entitlement`, { as: 'nora' })).status).toBe(403);
  });

  it.each([
    ['yearly by default', {}, 'price_test_year'],
    ['monthly when chosen', { interval: 'month' }, 'price_test_month'],
  ])(
    'starts Stripe Checkout (%s) with the free trial and the club and plan in metadata',
    async (_, choice, price) => {
      createCheckoutSession.mockClear();
      const res = await call('POST', `/clubs/${oak()}/checkout`, {
        as: 'ada',
        body: { planId: 'club_standard', ...choice },
      });
      expect(res).toEqual({ status: 200, body: { url: 'https://checkout.stripe.test/s' } });
      const metadata = { club_id: oak(), plan_id: 'club_standard' };
      expect(createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription',
          line_items: [{ price, quantity: 1 }],
          client_reference_id: oak(),
          metadata,
          subscription_data: { metadata, trial_period_days: CLUB_PRICING.trialDays },
        }),
      );
    },
  );

  it('refuses checkout for members, unknown plans or intervals, and plans without a price', async () => {
    const path = `/clubs/${oak()}/checkout`;
    expect(
      (await call('POST', path, { as: 'max', body: { planId: 'club_standard' } })).status,
    ).toBe(403);
    expect((await call('POST', path, { as: 'ada', body: { planId: 'no_such_plan' } })).status).toBe(
      400,
    );
    expect(
      (await call('POST', path, { as: 'ada', body: { planId: 'club_standard', interval: 'week' } }))
        .status,
    ).toBe(400);
    await w.data.putPlan(SERVICE, { id: 'unpriced', name: 'Unpriced', active: true });
    expect(await call('POST', path, { as: 'ada', body: { planId: 'unpriced' } })).toMatchObject({
      status: 503,
      body: { error: { code: 'not_configured' } },
    });
  });
});

describe('billing portal', () => {
  const path = () => `/clubs/${oak()}/billing-portal`;

  it("opens Stripe's customer portal for the club's customer, back to Billing", async () => {
    expect(await call('POST', path(), { as: 'ada' })).toMatchObject({
      status: 200,
      body: { url: 'https://billing.stripe.test/p' },
    });
    expect(createPortalSession).toHaveBeenCalledWith({
      customer: `cus_${oak()}`,
      return_url: PORTAL_RETURN,
    });
  });

  it('is for admins only, and needs a subscription', async () => {
    expect((await call('POST', path(), { as: 'max' })).status).toBe(403);
    const created = await call('POST', '/clubs', {
      as: 'nora',
      body: { club: { name: 'No Sub Club' }, admin: { displayName: 'Nora', initials: 'NO' } },
    });
    expect(
      (await call('POST', `/clubs/${created.body.id}/billing-portal`, { as: 'nora' })).status,
    ).toBe(404);
  });

  it('answers not_configured, like Checkout, while Stripe prices are unset', async () => {
    expect(await call('POST', path(), { as: 'ada', via: makeApi({}) })).toMatchObject({
      status: 503,
      body: { error: { code: 'not_configured' } },
    });
  });
});

describe('map packs', () => {
  const path = () => `/clubs/${oak()}/map-packs`;

  it('asks for the property line first', async () => {
    expect(await call('POST', path(), { as: 'ada', body: { basemap: 'topo' } })).toMatchObject({
      status: 400,
      body: { error: { code: 'invalid', message: 'draw the property line first' } },
    });
  });

  const packs = async () => (await call('GET', path(), { as: 'max' })).body as MapPack[];

  it('starts a build for an admin, answers 202 and lists the pack as building', async () => {
    await w.data.updateClub(SERVICE, oak(), { boundary: POLYGON });
    const res = await call('POST', path(), { as: 'ada', body: { basemap: 'aerial', maxZoom: 14 } });
    expect(res).toMatchObject({
      status: 202,
      body: { packId: expect.any(String), tiles: expect.any(Number), bytes: expect.any(Number) },
    });
    const { packId } = res.body as MapPackRequestResponse;
    expect(startMapPackBuild).toHaveBeenCalledWith({
      clubId: oak(),
      packId,
      basemap: 'aerial',
      minZoom: 8,
      maxZoom: 14,
      bounds: [-90, 40, -89.99, 40.01],
    });
    expect(await packs()).toEqual([
      expect.objectContaining({ id: packId, status: 'building', source: 'usgs-imagery' }),
    ]);
  });

  it('allows one build at a time per club (409 while one is pending)', async () => {
    const res = await call('POST', path(), { as: 'ada', body: { basemap: 'topo' } });
    expect(res).toMatchObject({ status: 409, body: { error: { code: 'conflict' } } });
    const [pending] = await packs();
    await w.data.finishMapPack(SERVICE, oak(), pending!.id, {
      sizeBytes: 10,
      builtAt: new Date().toISOString(),
    });
  });

  it('marks the pack failed and frees the club when the builder cannot be started', async () => {
    startMapPackBuild.mockRejectedValueOnce(new Error('lambda throttled'));
    expect((await call('POST', path(), { as: 'ada', body: { basemap: 'topo' } })).status).toBe(500);
    expect((await packs()).map((p) => p.status).sort()).toEqual(['failed', 'ready']);
    expect((await call('POST', path(), { as: 'ada', body: { basemap: 'topo' } })).status).toBe(202);
  });

  it('refuses members, unknown basemaps and properties over the caps', async () => {
    expect((await call('POST', path(), { as: 'max', body: { basemap: 'topo' } })).status).toBe(403);
    expect((await call('POST', path(), { as: 'ada', body: { basemap: 'satellite' } })).status).toBe(
      400,
    );
    // Far over the caps. The shared property-line rule now refuses such a line on save, so it is
    // stored directly, as a club saved before the rule would hold it; the map-pack request's own
    // size check is the second line of defence.
    const huge = {
      type: 'Polygon' as const,
      coordinates: [
        [
          [-95, 35],
          [-95, 45],
          [-85, 45],
          [-95, 35],
        ],
      ],
    };
    await expectCode(w.data.updateClub(SERVICE, oak(), { boundary: huge }), 'invalid');
    await w.storeClubFields(oak(), { boundary: huge });
    expect((await w.data.getClub(SERVICE, oak())).boundary).toEqual(huge);
    expect(await call('POST', path(), { as: 'ada', body: { basemap: 'topo' } })).toMatchObject({
      status: 400,
      body: { error: { code: 'invalid' } },
    });
  });

  it('needs an active subscription', async () => {
    await w.data.applyStripeEvent(SERVICE, {
      eventId: 'evt_mappack_lapsed',
      clubId: w.club('Pine Hollow'),
      stripeCustomerId: 'cus_pine',
      stripeSubscriptionId: `sub_${w.club('Pine Hollow')}`,
      planId: 'club_standard',
      status: 'canceled',
    });
    const res = await call('POST', `/clubs/${w.club('Pine Hollow')}/map-packs`, {
      as: 'pat',
      body: { basemap: 'topo' },
    });
    expect(res).toMatchObject({ status: 403, body: { error: { code: 'club_inactive' } } });
  });
});
