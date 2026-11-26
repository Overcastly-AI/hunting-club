import { STRIPE_WEBHOOK_SECRETS, secretName, secretNameEnvVar } from '../config';
import { handler as keepAlive } from '../lambda/keep-alive';
import { handler as stripeWebhook } from '../lambda/stripe-webhook';

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});
beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));

const post = { requestContext: { http: { method: 'POST' } } };

describe('stripe-webhook stub', () => {
  it('answers 501 when the secret names are wired up', async () => {
    process.env.ENV_NAME = 'dev';
    for (const key of STRIPE_WEBHOOK_SECRETS)
      process.env[secretNameEnvVar(key)] = secretName('dev', key);
    const res = await stripeWebhook(post);
    expect(res.statusCode).toBe(501);
  });

  it('answers 500 and names what is missing when misconfigured', async () => {
    process.env.ENV_NAME = 'dev';
    for (const key of STRIPE_WEBHOOK_SECRETS) delete process.env[secretNameEnvVar(key)];
    const res = await stripeWebhook(post);
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).missing).toContain('STRIPE_WEBHOOK_SECRET_NAME');
  });
});

describe('keep-alive stub', () => {
  it('skips while no Supabase project is configured', async () => {
    process.env.SUPABASE_URL = '';
    await expect(keepAlive()).resolves.toEqual({ status: 'skipped' });
  });
});
