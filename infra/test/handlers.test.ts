import { API_ENV, STRIPE_WEBHOOK_SECRETS, secretName, secretNameEnvVar } from '../config';
import { handler as clubApi } from '../lambda/club-api';
import { handler as stripeWebhook } from '../lambda/stripe-webhook';

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});
beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));

function wireApiEnv() {
  process.env[API_ENV.envName] = 'dev';
  process.env[API_ENV.tableName] = 'table';
  process.env[API_ENV.userPoolId] = 'us-east-1_pool';
  process.env[API_ENV.userPoolClientIds] = 'app,web';
  for (const key of STRIPE_WEBHOOK_SECRETS) {
    process.env[secretNameEnvVar(key)] = secretName('dev', key);
  }
}

const post = (headers: Record<string, string> = {}) => ({
  headers,
  requestContext: { http: { method: 'POST' } },
});

describe('club-api stub', () => {
  it('rejects requests without a bearer token', async () => {
    wireApiEnv();
    expect((await clubApi(post())).statusCode).toBe(401);
    expect((await clubApi(post({ authorization: 'Basic abc' }))).statusCode).toBe(401);
  });

  it('answers 501 to an authenticated request', async () => {
    wireApiEnv();
    expect((await clubApi(post({ authorization: 'Bearer eyJ' }))).statusCode).toBe(501);
  });

  it('answers 500 and names what is missing when misconfigured', async () => {
    wireApiEnv();
    delete process.env[API_ENV.userPoolId];
    const res = await clubApi(post({ authorization: 'Bearer eyJ' }));
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).missing).toEqual([API_ENV.userPoolId]);
  });
});

describe('stripe-webhook stub', () => {
  it('answers 501 when the table and secret names are wired up', async () => {
    wireApiEnv();
    expect((await stripeWebhook(post())).statusCode).toBe(501);
  });

  it('answers 500 and names what is missing when misconfigured', async () => {
    wireApiEnv();
    delete process.env[API_ENV.tableName];
    delete process.env[secretNameEnvVar('stripeWebhookSecret')];
    const res = await stripeWebhook(post());
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).missing).toEqual([API_ENV.tableName, 'STRIPE_WEBHOOK_SECRET_NAME']);
  });
});
