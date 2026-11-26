// Port of supabase/tests/database/30_billing_and_service_tables.test.sql: plans,
// subscriptions, Stripe events and map packs (service-written data).
import { type MapPackStart, type StripeEventApply, mapPackKey } from '@huntclub/shared';
import { ANONYMOUS, SERVICE } from '../index';
import { World, expectCode } from '../testing/world';

let w: World;
const oak = () => w.club('Oak Ridge');

const PACK: MapPackStart = {
  bounds: [-90, 40, -89.9, 40.1],
  minZoom: 10,
  maxZoom: 16,
  source: 'usgs',
};
let packId: string;
const syncOak = (eventId: string, overrides: Partial<StripeEventApply> = {}): StripeEventApply => ({
  eventId,
  clubId: oak(),
  stripeCustomerId: `cus_${oak()}`,
  stripeSubscriptionId: `sub_${oak()}`,
  planId: 'club_standard',
  status: 'active',
  ...overrides,
});

beforeAll(async () => {
  w = await World.seedTwoClubs();
  packId = (await w.data.startMapPackBuild(w.as('ada'), oak(), PACK)).id;
  await w.data.finishMapPack(SERVICE, oak(), packId, {
    sizeBytes: 1024,
    builtAt: w.clock.inDays(0),
  });
  await w.data.putPlan(SERVICE, { id: 'retired_plan', name: 'Old', memberLimit: 5, active: false });
});
afterAll(() => w.destroy());

describe('plans', () => {
  it('anyone can read active plans', async () => {
    expect((await w.data.listPlans(ANONYMOUS)).map((p) => p.id)).toEqual(['club_standard']);
    expect((await w.data.listPlans(SERVICE)).map((p) => p.id).sort()).toEqual([
      'club_standard',
      'retired_plan',
    ]);
  });

  it('anonymous users cannot change plans', async () => {
    await expectCode(
      w.data.putPlan(ANONYMOUS, {
        id: 'club_standard',
        name: 'Free',
        memberLimit: 1000,
        active: true,
      }),
      'not_authenticated',
    );
  });

  it('admins cannot change plans', async () => {
    await expectCode(
      w.data.putPlan(w.as('ada'), {
        id: 'club_standard',
        name: 'Big',
        memberLimit: 1000,
        active: true,
      }),
      'forbidden',
    );
    const [plan] = await w.data.listPlans(ANONYMOUS);
    expect(plan?.memberLimit).toBe(50);
  });
});

describe('subscriptions', () => {
  it("an admin reads their own club's subscription only", async () => {
    expect((await w.data.getSubscription(w.as('ada'), oak())).status).toBe('active');
    await expectCode(w.data.getSubscription(w.as('ada'), w.club('Pine Hollow')), 'forbidden');
  });

  it('an admin cannot edit the subscription', async () => {
    await expectCode(
      w.data.applyStripeEvent(
        w.as('ada'),
        syncOak('evt_admin1', { paidThrough: '9999-12-31T00:00:00.000Z' }),
      ),
      'forbidden',
    );
  });

  it('an admin cannot create subscriptions', async () => {
    await expectCode(
      w.data.applyStripeEvent(
        w.as('ada'),
        syncOak('evt_admin2', { stripeSubscriptionId: 'sub_x' }),
      ),
      'forbidden',
    );
  });

  it('a member cannot read billing', async () => {
    await expectCode(w.data.getSubscription(w.as('max'), oak()), 'forbidden');
  });

  it('the webhook Lambda (service) updates subscriptions', async () => {
    expect(
      await w.data.applyStripeEvent(SERVICE, syncOak('evt_pastdue', { status: 'past_due' })),
    ).toBe('applied');
    expect((await w.data.getSubscription(SERVICE, oak())).status).toBe('past_due');
  });
});

describe('Stripe events', () => {
  it('the service records processed Stripe events', async () => {
    expect(await w.data.applyStripeEvent(SERVICE, syncOak('evt_123'))).toBe('applied');
    expect(await w.data.getStripeEvent(SERVICE, 'evt_123')).toMatchObject({ eventId: 'evt_123' });
  });

  it('a Stripe event is processed at most once', async () => {
    expect(await w.data.applyStripeEvent(SERVICE, syncOak('evt_123', { status: 'canceled' }))).toBe(
      'duplicate',
    );
    expect((await w.data.getSubscription(SERVICE, oak())).status).toBe('active');
  });

  it('signed-in users cannot read Stripe events', async () => {
    await expectCode(w.data.getStripeEvent(w.as('ada'), 'evt_123'), 'forbidden');
  });

  it('signed-in users cannot write Stripe events', async () => {
    await expectCode(w.data.applyStripeEvent(w.as('ada'), syncOak('evt_fake')), 'forbidden');
    expect(await w.data.getStripeEvent(SERVICE, 'evt_fake')).toBeUndefined();
  });

  // New with DynamoDB: the event record and the subscription commit together, and a
  // failed apply records nothing, so Stripe's retry gets another chance.
  it('a Stripe subscription belongs to exactly one club; a failed apply records nothing', async () => {
    await expectCode(
      w.data.applyStripeEvent(SERVICE, syncOak('evt_steal', { clubId: w.club('Pine Hollow') })),
      'conflict',
    );
    expect(await w.data.getStripeEvent(SERVICE, 'evt_steal')).toBeUndefined();
  });
});

describe('map packs', () => {
  it("a member reads their club's map packs", async () => {
    expect((await w.data.listMapPacks(w.as('max'), oak())).map((p) => p.s3Key)).toEqual([
      mapPackKey(oak(), packId),
    ]);
  });

  it('members cannot start or finish map packs', async () => {
    await expectCode(w.data.startMapPackBuild(w.as('max'), oak(), PACK), 'forbidden');
    await expectCode(
      w.data.finishMapPack(w.as('ada'), oak(), packId, {
        sizeBytes: 1,
        builtAt: w.clock.inDays(0),
      }),
      'forbidden',
    );
  });

  it('admins cannot delete map packs (map-pack Lambda only)', async () => {
    const [pack] = await w.data.listMapPacks(SERVICE, oak());
    await expectCode(w.data.deleteMapPack(w.as('ada'), oak(), pack!.id), 'forbidden');
    expect(await w.data.listMapPacks(SERVICE, oak())).toHaveLength(1);
  });

  it("another club cannot see this club's packs", async () => {
    await expectCode(w.data.listMapPacks(w.as('pat'), oak()), 'forbidden');
  });

  it('anonymous users cannot read map packs', async () => {
    await expectCode(w.data.listMapPacks(ANONYMOUS, oak()), 'not_authenticated');
  });
});
