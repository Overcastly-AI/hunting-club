// Club API handler end to end: Function URL event → JWT check → routes → club-data on
// DynamoDB Local. Permission rules themselves are covered in club-data's tests; these
// check the HTTP contract (status codes, error shape, auth, body validation).
import { World, keyOf } from '@huntclub/club-data/testing';
import { SERVICE } from '@huntclub/club-data';
import { cognitoVerifier } from '../auth';
import type { StripeApi } from '../billing';
import { createClubApi } from '../clubApi';
import type { Handler } from '../http';
import { TEST_POOL, TestUserPool } from '../testing/jwt';
import { urlEvent } from '../testing/requests';

let w: World;
let api: Handler;
const pool = new TestUserPool();
const createCheckoutSession = jest.fn(async () => ({ url: 'https://checkout.stripe.test/s' }));
const fakeStripe = { createCheckoutSession } as unknown as StripeApi;

beforeAll(async () => {
  w = await World.seedTwoClubs();
  api = createClubApi({
    data: w.data,
    verifier: cognitoVerifier(TEST_POOL, pool.jwks),
    stripe: async () => fakeStripe,
    checkout: {
      prices: { club_standard: 'price_test_123' },
      successUrl: 'https://web.test/checkout/done',
      cancelUrl: 'https://web.test/checkout/cancel',
    },
  });
});
afterAll(() => w.destroy());
beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));

const oak = () => w.club('Oak Ridge');
async function call(
  method: string,
  path: string,
  opts: { as?: string; body?: unknown; token?: string; rawBody?: string } = {},
) {
  const token = opts.token ?? (opts.as ? pool.accessToken(w.user(opts.as)) : undefined);
  const res = await api(
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
      keyVersion: 1,
    });
    expect((await call('GET', `/clubs/${oak()}/secret`, { as: 'max' })).status).toBe(403);
  });

  it('admins rotate it; a wrong-length key is rejected', async () => {
    const channelKey = Buffer.from(keyOf('ef')).toString('base64');
    const res = await call('PUT', `/clubs/${oak()}/secret`, { as: 'ada', body: { channelKey } });
    expect(res.body).toMatchObject({ channelKey, keyVersion: 2 });
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
      status: 'active',
    });
    expect((await call('GET', `/clubs/${oak()}/subscription`, { as: 'max' })).status).toBe(403);
  });

  it("starts Stripe Checkout for an admin's club with the club and plan in metadata", async () => {
    const res = await call('POST', `/clubs/${oak()}/checkout`, {
      as: 'ada',
      body: { planId: 'club_standard' },
    });
    expect(res).toEqual({ status: 200, body: { url: 'https://checkout.stripe.test/s' } });
    const metadata = { club_id: oak(), plan_id: 'club_standard' };
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        line_items: [{ price: 'price_test_123', quantity: 1 }],
        client_reference_id: oak(),
        metadata,
        subscription_data: { metadata },
      }),
    );
  });

  it('refuses checkout for members, unknown plans and plans without a price', async () => {
    const path = `/clubs/${oak()}/checkout`;
    expect(
      (await call('POST', path, { as: 'max', body: { planId: 'club_standard' } })).status,
    ).toBe(403);
    expect((await call('POST', path, { as: 'ada', body: { planId: 'no_such_plan' } })).status).toBe(
      400,
    );
    await w.data.putPlan(SERVICE, { id: 'unpriced', name: 'Unpriced', active: true });
    expect(await call('POST', path, { as: 'ada', body: { planId: 'unpriced' } })).toMatchObject({
      status: 503,
      body: { error: { code: 'not_configured' } },
    });
  });
});
