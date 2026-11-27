import { createClubApiClient, ClubApiRequestError } from '../apiClient';
import { apiPath, API_PATHS } from '../apiPaths';
import { entitlementFor, ENTITLEMENT_GRACE_DAYS, hasClubFeatures } from '../api';
import { DOWNLOAD_LIMITS } from '../maps';
import { DAY_MS } from '../time';
import { scriptedFetch } from './fakeFetch';

const CLUB = '00000000-0000-4000-8000-000000000001';
const ISO = '2026-11-26T00:00:00.000Z';
const stand = {
  id: '00000000-0000-4000-8000-000000000002',
  clubId: CLUB,
  meshId: 1,
  name: 'Oak',
  type: 'ladder',
  lat: 40,
  lon: -90,
  active: true,
  createdAt: ISO,
  updatedAt: ISO,
};

function client(
  responses: { status: number; body?: unknown }[],
  token = 'tok',
  refresh?: () => Promise<boolean>,
) {
  const f = scriptedFetch(responses);
  return {
    ...f,
    api: createClubApiClient({
      baseUrl: 'https://api.test',
      fetch: f.fetch,
      accessToken: async () => token,
      ...(refresh ? { refresh } : {}),
    }),
  };
}

describe('apiPath', () => {
  it('fills and encodes parameters, and refuses missing ones', () => {
    expect(apiPath(API_PATHS.stand, { clubId: CLUB, id: 'a/b' })).toBe(
      `/clubs/${CLUB}/stands/a%2Fb`,
    );
    expect(() => apiPath(API_PATHS.stand, { clubId: CLUB })).toThrow('missing path parameter id');
  });
});

describe('club API client', () => {
  it('sends the bearer token to the shared path and parses with the shared schema', async () => {
    const { api, calls } = client([{ status: 200, body: [stand] }]);
    expect(await api.listStands(CLUB)).toEqual([stand]);
    expect(calls[0]).toMatchObject({
      url: `https://api.test/clubs/${CLUB}/stands`,
      method: 'GET',
      headers: { authorization: 'Bearer tok' },
    });
  });

  it('turns the error shape into ClubApiRequestError with the server code', async () => {
    const { api } = client([
      { status: 403, body: { error: { code: 'forbidden', message: 'forbidden' } } },
    ]);
    await expect(api.getClub(CLUB)).rejects.toMatchObject({ code: 'forbidden', status: 403 });
  });

  it('refreshes once on 401 and retries', async () => {
    const refresh = jest.fn(async () => true);
    const { api, calls } = client(
      [
        { status: 401, body: { error: { code: 'not_authenticated', message: '' } } },
        { status: 200, body: [stand] },
      ],
      'tok',
      refresh,
    );
    expect(await api.listStands(CLUB)).toHaveLength(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(2);
  });

  it('reports no connection as network, and a malformed body as bad_response', async () => {
    await expect(client([]).api.listPlans()).rejects.toMatchObject({ code: 'network' });
    await expect(
      client([{ status: 200, body: [{ nope: 1 }] }]).api.listStands(CLUB),
    ).rejects.toBeInstanceOf(ClubApiRequestError);
  });

  it('creates a club and an invite with POSTs to the shared paths', async () => {
    const club = {
      id: CLUB,
      name: 'Pine Hollow',
      region: 'US',
      overdueGraceMinutes: 30,
      createdAt: ISO,
      updatedAt: ISO,
    };
    const invite = {
      id: '00000000-0000-4000-8000-000000000003',
      clubId: CLUB,
      token: 'ab'.repeat(32),
      role: 'member',
      maxUses: 1,
      uses: 0,
      expiresAt: ISO,
      createdAt: ISO,
      updatedAt: ISO,
    };
    const { api, calls } = client([
      { status: 201, body: club },
      { status: 201, body: invite },
    ]);
    const request = {
      club: { name: 'Pine Hollow' },
      admin: { displayName: 'Pat Lane', initials: 'PL' },
    };
    expect(await api.createClub(request)).toEqual(club);
    expect(
      await api.createInvite(CLUB, { role: 'member', maxUses: 1, expiresAt: ISO }),
    ).toMatchObject({ token: invite.token });
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ['POST', 'https://api.test/clubs'],
      ['POST', `https://api.test/clubs/${CLUB}/invites`],
    ]);
    expect(calls[0]!.body).toMatchObject(request);
  });

  it("lists a club's invites with GET and checks them against the shared schema", async () => {
    const invite = {
      id: '00000000-0000-4000-8000-0000000000f1',
      clubId: CLUB,
      token: 'cd'.repeat(32),
      role: 'guest',
      uses: 0,
      expiresAt: ISO,
      createdAt: ISO,
      updatedAt: ISO,
    };
    const { api, calls } = client([
      { status: 200, body: [invite] },
      { status: 200, body: [{ ...invite, uses: -1 }] },
    ]);
    expect(await api.listInvites(CLUB)).toEqual([invite]);
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ['GET', `https://api.test/clubs/${CLUB}/invites`],
    ]);
    await expect(api.listInvites(CLUB)).rejects.toMatchObject({ code: 'bad_response' });
  });

  it('starts Checkout and returns only an https Stripe URL', async () => {
    const url = 'https://checkout.stripe.com/c/pay/cs_test_1';
    const { api, calls } = client([
      { status: 200, body: { url } },
      { status: 200, body: { url: 'javascript:alert(1)' } },
    ]);
    expect(await api.startCheckout(CLUB, { planId: 'club_standard' })).toEqual({ url });
    expect(calls[0]).toMatchObject({
      method: 'POST',
      url: `https://api.test/clubs/${CLUB}/checkout`,
      body: { planId: 'club_standard' },
    });
    await expect(api.startCheckout(CLUB, { planId: 'club_standard' })).rejects.toMatchObject({
      code: 'bad_response',
    });
  });

  it("updates a member's name with PATCH, normalized by the shared rule, and refuses a bad one", async () => {
    const USER = '64d824c8-a0d1-70a9-fdfc-1f8138e91b49';
    const member = {
      clubId: CLUB,
      userId: USER,
      displayName: 'Jane Doe',
      initials: 'JD',
      role: 'admin',
      createdAt: ISO,
      updatedAt: ISO,
    };
    const { api, calls } = client([{ status: 200, body: member }]);
    expect(
      await api.updateMemberProfile(CLUB, USER, { displayName: '  Jane   Doe ', initials: 'JD' }),
    ).toEqual(member);
    expect(calls[0]).toMatchObject({
      method: 'PATCH',
      url: `https://api.test/clubs/${CLUB}/members/${USER}`,
      body: { displayName: 'Jane Doe', initials: 'JD' },
    });
    await expect(
      api.updateMemberProfile(CLUB, USER, { displayName: 'jane_doe' }),
    ).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });

  it('validates the redeem request before sending it', async () => {
    const { api, calls } = client([]);
    await expect(
      api.redeemInvite({ token: 'short', displayName: 'A', initials: 'A' }),
    ).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});

describe('entitlementFor', () => {
  it('opens features until paid-through plus the grace period for entitled statuses', () => {
    const e = entitlementFor(CLUB, { status: 'past_due', paidThrough: ISO });
    expect(Date.parse(e.featuresUntil!) - Date.parse(ISO)).toBe(ENTITLEMENT_GRACE_DAYS * DAY_MS);
  });

  it('keeps features closed when canceled or without a subscription', () => {
    expect(
      entitlementFor(CLUB, { status: 'canceled', paidThrough: ISO }).featuresUntil,
    ).toBeUndefined();
    expect(entitlementFor(CLUB, undefined)).toEqual({ clubId: CLUB });
  });
});

describe('hasClubFeatures', () => {
  it('is closed without an entitlement or a featuresUntil date', () => {
    expect(hasClubFeatures(null, 0)).toBe(false);
    expect(hasClubFeatures({}, 0)).toBe(false);
    expect(hasClubFeatures(entitlementFor(CLUB, undefined), 0)).toBe(false);
  });

  it('is open until featuresUntil (ISO from the API or epoch ms on a phone), then freezes', () => {
    const until = Date.parse(ISO);
    for (const featuresUntil of [ISO, until]) {
      expect(hasClubFeatures({ featuresUntil }, until - 1)).toBe(true);
      expect(hasClubFeatures({ featuresUntil }, new Date(until))).toBe(false);
    }
  });
});

describe('map packs', () => {
  it('requests a pack with the defaults filled in and parses the 202 answer', async () => {
    const answer = { packId: '00000000-0000-4000-8000-000000000003', tiles: 120, bytes: 4_000_000 };
    const { api, calls } = client([{ status: 202, body: answer }]);
    expect(await api.requestMapPack(CLUB, { basemap: 'topo' })).toEqual(answer);
    expect(calls[0]).toMatchObject({
      url: `https://api.test/clubs/${CLUB}/map-packs`,
      method: 'POST',
    });
    expect(calls[0]!.body).toEqual({
      basemap: 'topo',
      minZoom: DOWNLOAD_LIMITS.minZoom,
      maxZoom: DOWNLOAD_LIMITS.maxZoom,
    });
  });

  it('refuses a bad request before calling the server', async () => {
    const { api, calls } = client([]);
    await expect(
      api.requestMapPack(CLUB, { basemap: 'topo', minZoom: 15, maxZoom: 9 }),
    ).rejects.toThrow('minZoom must not exceed maxZoom');
    expect(calls).toHaveLength(0);
  });
});
