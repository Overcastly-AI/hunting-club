// The Lambda entry points: configuration checks and the auth gate. The handlers'
// behaviour is tested in packages/api against DynamoDB Local.
import {
  API_ENV,
  CLUB_API_SECRETS,
  STRIPE_WEBHOOK_SECRETS,
  secretParameterName,
  secretParameterEnvVar,
} from '../config';
import { handler as clubApi } from '../lambda/club-api';
import { handler as mapPackBuilder, userAgent } from '../lambda/map-pack-builder';
import { handler as stripeWebhook } from '../lambda/stripe-webhook';

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});
beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));

function wireEnv() {
  process.env[API_ENV.envName] = 'dev';
  process.env[API_ENV.tableName] = 'table';
  process.env[API_ENV.userPoolId] = 'us-east-1_pool';
  process.env[API_ENV.userPoolClientIds] = 'app,web';
  process.env[API_ENV.webOrigin] = 'https://web.test';
  process.env[API_ENV.stripePrices] = '{}';
  process.env[API_ENV.mapPackBuilder] = 'builder';
  process.env[API_ENV.mapPackBucket] = 'bucket';
  for (const key of [...CLUB_API_SECRETS, ...STRIPE_WEBHOOK_SECRETS]) {
    process.env[secretParameterEnvVar(key)] = secretParameterName('dev', key);
  }
}

const request = (path: string, headers: Record<string, string> = {}) => ({
  rawPath: path,
  headers,
  requestContext: { http: { method: 'GET' } },
});

describe('club-api entry', () => {
  it('rejects requests without a valid bearer token before touching the table', async () => {
    wireEnv();
    expect((await clubApi(request('/me/clubs'))).statusCode).toBe(401);
    expect((await clubApi(request('/me/clubs', { authorization: 'Basic abc' }))).statusCode).toBe(
      401,
    );
    expect(
      (await clubApi(request('/me/clubs', { authorization: 'Bearer not.a.jwt' }))).statusCode,
    ).toBe(401);
  });

  it('answers 503 and names what is missing when misconfigured', async () => {
    wireEnv();
    delete process.env[API_ENV.userPoolId];
    const res = await clubApi(request('/me/clubs'));
    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body).error).toEqual({
      code: 'not_configured',
      message: `missing ${API_ENV.userPoolId}`,
    });
  });
});

describe('stripe-webhook entry', () => {
  it('refuses an unsigned request with 400 before reading any secret', async () => {
    wireEnv();
    // Even with no configuration at all, an unsigned request gets a plain 400.
    delete process.env[API_ENV.tableName];
    const res = await stripeWebhook(request('/'));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe('invalid');
  });

  it('answers 503 and names what is missing when misconfigured', async () => {
    wireEnv();
    delete process.env[API_ENV.tableName];
    delete process.env[secretParameterEnvVar('stripeWebhookSecret')];
    const res = await stripeWebhook(request('/', { 'stripe-signature': 't=1,v1=x' }));
    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body).error.message).toBe(
      `missing ${API_ENV.tableName}, ${secretParameterEnvVar('stripeWebhookSecret')}`,
    );
  });
});

describe('map-pack-builder entry', () => {
  it('fails loudly and names what is missing when misconfigured', async () => {
    wireEnv();
    delete process.env[API_ENV.mapPackBucket];
    await expect(mapPackBuilder({})).rejects.toThrow(`missing ${API_ENV.mapPackBucket}`);
  });

  it('rejects a malformed build before fetching anything', async () => {
    wireEnv();
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    await expect(mapPackBuilder({ clubId: 'x' })).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('identifies itself to USGS by product and site only', () => {
    expect(userAgent('https://web.test')).toBe('HuntClubMesh-MapPacks/1.0 (+https://web.test)');
  });
});
