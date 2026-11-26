// Port of supabase/tests/database/50_harvests.test.sql: harvests are the hunter's own;
// the club sees them only while shared.
import type { Harvest } from '@huntclub/shared';
import { ANONYMOUS, SERVICE } from '../index';
import { World, expectCode } from '../testing/world';

let w: World;
let maxShared: Harvest;
let gusPrivate: Harvest;
let patShared: Harvest;

beforeAll(async () => {
  w = await World.seedTwoClubs();
  await w.addMember('Pine Hollow', 'max'); // max is in both clubs
  maxShared = await w.createHarvest('Oak Ridge', 'max', true);
  gusPrivate = await w.createHarvest('Oak Ridge', 'gus', false);
  patShared = await w.createHarvest('Pine Hollow', 'pat', true);
});
afterAll(() => w.destroy());

const oak = () => w.club('Oak Ridge');
const pine = () => w.club('Pine Hollow');
const visible = async (who: string, club = oak()) =>
  (await w.data.listHarvests(w.as(who), club)).map((h) => h.id);

it("a hunter sees their own unshared harvest plus the club's shared ones", async () => {
  expect((await visible('gus')).sort()).toEqual([maxShared.id, gusPrivate.id].sort());
});

it("a member of two clubs sees shared harvests from both, and not gus's private one", async () => {
  expect(await visible('max', oak())).toEqual([maxShared.id]);
  expect(await visible('max', pine())).toEqual([patShared.id]);
});

it("a hunter cannot edit someone else's harvest", async () => {
  await expectCode(
    w.data.updateHarvest(w.as('max'), pine(), patShared.id, { notes: 'nice' }),
    'forbidden',
  );
  // A private harvest of someone else is invisible, so it looks missing.
  await expectCode(
    w.data.updateHarvest(w.as('max'), oak(), gusPrivate.id, { notes: 'nice' }),
    'not_found',
  );
});

it('a hunter cannot log a harvest as someone else', async () => {
  await expectCode(
    w.data.createHarvest(w.as('max'), oak(), {
      species: 'doe',
      harvestedAt: w.clock.inDays(0),
      userId: w.user('gus'),
    } as never),
    'invalid',
  );
});

it('a hunter shares a harvest with their club', async () => {
  const turkey = await w.data.createHarvest(w.as('max'), oak(), {
    species: 'turkey',
    sex: 'male',
    harvestedAt: w.clock.inDays(0),
    shared: true,
  });
  expect(turkey).toMatchObject({ userId: w.user('max'), clubId: oak(), shared: true });
});

it('a hunter withdraws their shares', async () => {
  const mine = (await w.data.listHarvests(w.as('max'), oak())).filter(
    (h) => h.userId === w.user('max'),
  );
  expect(mine).toHaveLength(2);
  for (const h of mine) {
    expect((await w.data.updateHarvest(w.as('max'), oak(), h.id, { shared: false })).shared).toBe(
      false,
    );
  }
});

it('unshared harvests disappear for the rest of the club', async () => {
  expect(await visible('gus')).toEqual([gusPrivate.id]);
});

it('a user in no club sees no harvests', async () => {
  expect(await visible('nora')).toEqual([]);
});

it('a non-member cannot log harvests in a club', async () => {
  await expectCode(
    w.data.createHarvest(w.as('nora'), oak(), { species: 'doe', harvestedAt: w.clock.inDays(0) }),
    'forbidden',
  );
});

it('an expired guest sees no harvests', async () => {
  expect(await visible('eve')).toEqual([]);
});

it("another club's admin sees none of this club's harvests", async () => {
  expect(await visible('pat')).toEqual([]);
});

it("an admin can remove a member's shared harvest (moderation)", async () => {
  const gusShared = await w.createHarvest('Oak Ridge', 'gus', true);
  await w.data.deleteHarvest(w.as('ada'), oak(), gusShared.id);
  expect((await w.data.listHarvests(SERVICE, oak())).map((h) => h.id)).not.toContain(gusShared.id);
});

it("an admin cannot see or touch a member's private harvest", async () => {
  await expectCode(w.data.deleteHarvest(w.as('ada'), oak(), gusPrivate.id), 'not_found');
  expect((await w.data.listHarvests(SERVICE, oak())).map((h) => h.id)).toContain(gusPrivate.id);
});

it('anonymous users cannot read harvests', async () => {
  await expectCode(w.data.listHarvests(ANONYMOUS, oak()), 'not_authenticated');
});
