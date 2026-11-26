// Port of supabase/tests/database/60_redeem_invite.test.sql: expiry, use count,
// subscription status, plan member limit, idempotency, guest renewal, concurrency.
import { ANONYMOUS, SERVICE } from '../index';
import { World, expectCode, profile } from '../testing/world';

let w: World;
const tokens: Record<string, string> = {};

beforeAll(async () => {
  w = await World.seedTwoClubs();
  await w.data.putPlan(SERVICE, {
    id: 'tiny_test_plan',
    name: 'Tiny',
    memberLimit: 3,
    active: true,
  });
  await w.createClub('Small Camp', 'sid', { plan: 'tiny_test_plan' });
  await w.addMember('Small Camp', 'sal'); // 2 of 3 seats taken
  await w.createClub('Lapsed Lodge', 'lou', { status: 'canceled' });
  await w.createClub('Race Camp', 'rae', { plan: 'tiny_test_plan' });
  await w.addMember('Race Camp', 'ray'); // 2 of 3 seats taken

  tokens.oak = await w.createInvite('Oak Ridge');
  tokens.expired = await w.createInvite('Oak Ridge', { expiresAt: w.clock.inDays(-0.001) });
  tokens.single = await w.createInvite('Oak Ridge', { maxUses: 1 });
  tokens.small = await w.createInvite('Small Camp');
  tokens.small_guest = await w.createInvite('Small Camp', {
    role: 'guest',
    memberExpiresAt: w.clock.inDays(2),
  });
  tokens.lapsed = await w.createInvite('Lapsed Lodge');
  tokens.oak_guest_renewal = await w.createInvite('Oak Ridge', {
    role: 'guest',
    memberExpiresAt: w.clock.inDays(5),
  });
  tokens.race = await w.createInvite('Race Camp');
  tokens.race_single = await w.createInvite('Oak Ridge', { maxUses: 1 });
});
afterAll(() => w.destroy());

const redeem = (who: string, token: string) => w.data.redeemInvite(w.as(who), token, profile(who));
const usesOf = async (token: string) =>
  (await w.data.listInvites(SERVICE, w.club('Oak Ridge'))).find((i) => i.token === token)!.uses;

describe('happy path', () => {
  it('a valid invite joins the club as a member', async () => {
    expect((await redeem('hal', tokens.oak!)).role).toBe('member');
  });

  it("the new member can immediately read the club's stands", async () => {
    expect((await w.data.listStands(w.as('hal'), w.club('Oak Ridge'))).map((s) => s.name)).toEqual([
      'Creek Stand',
    ]);
  });

  it('re-scanning an invite you already used is harmless', async () => {
    expect((await redeem('hal', tokens.oak!)).userId).toBe(w.user('hal'));
  });

  it('a repeat redemption by an existing member consumes no use', async () => {
    expect(await usesOf(tokens.oak!)).toBe(1);
  });
});

describe('failures', () => {
  it('an unknown token is rejected', async () => {
    await expectCode(redeem('ivy', 'f'.repeat(64)), 'invite_not_found');
  });

  it('an expired invite is rejected', async () => {
    await expectCode(redeem('ivy', tokens.expired!), 'invite_expired');
  });

  it('a club with a canceled subscription admits no one', async () => {
    await expectCode(redeem('ivy', tokens.lapsed!), 'club_inactive');
  });

  it('a single-use invite works once', async () => {
    expect((await redeem('ivy', tokens.single!)).role).toBe('member');
  });

  it('a used-up invite is rejected', async () => {
    await expectCode(redeem('jo', tokens.single!), 'invite_used_up');
  });
});

describe('member limit (Small Camp: plan limit 3, two seats taken)', () => {
  it('the last seat can be taken', async () => {
    expect((await redeem('jo', tokens.small!)).role).toBe('member');
  });

  it('a full club rejects new members', async () => {
    await expectCode(redeem('kim', tokens.small!), 'club_full');
  });

  it('guest passes do not count toward the member limit', async () => {
    expect((await redeem('kim', tokens.small_guest!)).role).toBe('guest');
  });

  it('a guest membership expires', async () => {
    const kim = (await w.data.listMembers(SERVICE, w.club('Small Camp'))).find(
      (m) => m.userId === w.user('kim'),
    );
    expect(kim?.expiresAt).toBeDefined();
  });

  it('the club holds exactly its plan limit', async () => {
    const members = await w.data.listMembers(SERVICE, w.club('Small Camp'));
    expect(members.filter((m) => m.role !== 'guest')).toHaveLength(3);
  });
});

describe('an expired guest renews with a new guest invite', () => {
  it('an expired guest renews their pass with a new invite', async () => {
    const eve = await redeem('eve', tokens.oak_guest_renewal!);
    expect(eve.expiresAt! > w.clock.inDays(0)).toBe(true);
  });

  it('renewal updates the existing membership instead of adding a second one', async () => {
    const members = await w.data.listMembers(SERVICE, w.club('Oak Ridge'));
    expect(members.filter((m) => m.userId === w.user('eve'))).toHaveLength(1);
  });
});

describe('who may redeem', () => {
  it('a request without a user (the service) is rejected', async () => {
    await expectCode(
      w.data.redeemInvite(SERVICE, tokens.oak!, profile('nobody')),
      'not_authenticated',
    );
  });

  it('anonymous users cannot redeem invites', async () => {
    await expectCode(
      w.data.redeemInvite(ANONYMOUS, tokens.oak!, profile('anon')),
      'not_authenticated',
    );
  });

  it('rejected callers consume no use', async () => {
    expect(await usesOf(tokens.oak!)).toBe(1);
  });
});

describe('concurrency (one TransactWriteItems per redemption)', () => {
  it('concurrent redemptions never exceed the member limit', async () => {
    const racers = ['r1', 'r2', 'r3', 'r4', 'r5'];
    const results = await Promise.allSettled(racers.map((r) => redeem(r, tokens.race!)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    for (const r of results) {
      if (r.status === 'rejected') expect(r.reason).toMatchObject({ code: 'club_full' });
    }
    const members = await w.data.listMembers(SERVICE, w.club('Race Camp'));
    expect(members.filter((m) => m.role !== 'guest')).toHaveLength(3);
  });

  it('concurrent redemptions never exceed max uses', async () => {
    const racers = ['s1', 's2', 's3', 's4', 's5'];
    const results = await Promise.allSettled(racers.map((r) => redeem(r, tokens.race_single!)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await usesOf(tokens.race_single!)).toBe(1);
  });
});
