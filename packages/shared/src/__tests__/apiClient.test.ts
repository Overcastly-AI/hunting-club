import { createClubApiClient, ClubApiRequestError } from '../apiClient';
import { apiPath, API_PATHS } from '../apiPaths';
import { entitlementFor, ENTITLEMENT_GRACE_DAYS } from '../api';
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
    expect(Date.parse(e.featuresUntil!) - Date.parse(ISO)).toBe(
      ENTITLEMENT_GRACE_DAYS * 86_400_000,
    );
  });

  it('keeps features closed when canceled or without a subscription', () => {
    expect(
      entitlementFor(CLUB, { status: 'canceled', paidThrough: ISO }).featuresUntil,
    ).toBeUndefined();
    expect(entitlementFor(CLUB, undefined)).toEqual({ clubId: CLUB });
  });
});
