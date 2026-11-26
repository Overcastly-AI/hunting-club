import { FIXTURE_PLACES, NWS_FIXTURES } from '../../test-utils/nwsFixtures';
import { NWS_USER_AGENT, fetchForecastHours, type Fetch } from '../nwsClient';

function response(status: number, body: unknown): Response {
  return { status, ok: status >= 200 && status < 300, json: async () => body } as Response;
}

/** A fake api.weather.gov answering from the captured responses. */
function fakeNws(routes: Record<string, () => Response | Promise<Response>>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl: Fetch = async (url, init) => {
    calls.push({ url, init });
    const route = routes[url];
    return route ? route() : response(500, {});
  };
  return { fetchImpl, calls };
}

const POINTS = 'https://api.weather.gov/points/44.9778,-93.265';
const HOURLY = 'https://api.weather.gov/gridpoints/MPX/108,72/forecast/hourly';

describe('fetchForecastHours', () => {
  it('follows /points to the hourly forecast with a generic User-Agent', async () => {
    const { fetchImpl, calls } = fakeNws({
      [POINTS]: () => response(200, NWS_FIXTURES.pointsMinneapolis),
      [HOURLY]: () => response(200, NWS_FIXTURES.hourlyMinneapolis),
    });
    const outcome = await fetchForecastHours(FIXTURE_PLACES.minneapolis, fetchImpl);
    expect(outcome.kind).toBe('ok');
    if (outcome.kind === 'ok') expect(outcome.hours).toHaveLength(24);
    expect(calls.map((c) => c.url)).toEqual([POINTS, HOURLY]);
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers['User-Agent']).toBe(NWS_USER_AGENT);
    expect(NWS_USER_AGENT).toMatch(/^HuntClubMesh\/[\w.]+$/);
  });

  it('reports outside coverage when NWS has no data for the point', async () => {
    const { fetchImpl } = fakeNws({
      'https://api.weather.gov/points/51.5,-0.12': () =>
        response(404, NWS_FIXTURES.pointsOutsideUs),
    });
    expect(await fetchForecastHours(FIXTURE_PLACES.london, fetchImpl)).toEqual({
      kind: 'outsideCoverage',
    });
  });

  it('fails without throwing when offline or NWS errors', async () => {
    const offline: Fetch = () => Promise.reject(new TypeError('Network request failed'));
    expect(await fetchForecastHours(FIXTURE_PLACES.minneapolis, offline)).toEqual({
      kind: 'failed',
    });
    const { fetchImpl } = fakeNws({
      [POINTS]: () => response(200, NWS_FIXTURES.pointsMinneapolis),
      [HOURLY]: () => response(503, {}),
    });
    expect(await fetchForecastHours(FIXTURE_PLACES.minneapolis, fetchImpl)).toEqual({
      kind: 'failed',
    });
  });
});
