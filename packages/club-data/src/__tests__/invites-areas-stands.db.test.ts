// Port of supabase/tests/database/40_invites_areas_stands.test.sql: invites (admins
// only), areas and stands (members read, admins write).
import { propertyLinePolygon } from '@huntclub/shared';
import { SERVICE } from '../index';
import { POLYGON, World, expectCode } from '../testing/world';

let w: World;
beforeAll(async () => {
  w = await World.seedTwoClubs();
  await w.createInvite('Oak Ridge');
});
afterAll(() => w.destroy());

const oak = () => w.club('Oak Ridge');
const pine = () => w.club('Pine Hollow');
const standAt = (name: string) => ({ name, type: 'ladder' as const, lat: 40, lon: -90 });

describe('invites', () => {
  it("an admin reads their club's invites", async () => {
    expect(await w.data.listInvites(w.as('ada'), oak())).toHaveLength(1);
  });

  it('an admin creates a guest pass invite', async () => {
    const invite = await w.data.createInvite(w.as('ada'), oak(), {
      role: 'guest',
      expiresAt: w.clock.inDays(1),
      memberExpiresAt: w.clock.inDays(3),
    });
    expect(invite).toMatchObject({ role: 'guest', uses: 0, createdBy: w.user('ada') });
  });

  it('an admin revokes an invite', async () => {
    const guestInvite = (await w.data.listInvites(w.as('ada'), oak())).find(
      (i) => i.role === 'guest',
    );
    await w.data.deleteInvite(w.as('ada'), oak(), guestInvite!.id);
    expect(await w.data.listInvites(w.as('ada'), oak())).toHaveLength(1);
  });

  it('a member cannot read invite tokens', async () => {
    await expectCode(w.data.listInvites(w.as('max'), oak()), 'forbidden');
  });

  it('a member cannot create invites', async () => {
    await expectCode(
      w.data.createInvite(w.as('max'), oak(), { expiresAt: w.clock.inDays(1) }),
      'forbidden',
    );
  });

  it("another club's admin cannot read these invites", async () => {
    await expectCode(w.data.listInvites(w.as('pat'), oak()), 'forbidden');
  });
});

describe('areas', () => {
  it("a member reads their club's areas", async () => {
    expect((await w.data.listAreas(w.as('max'), oak())).map((a) => a.name)).toEqual(['North 40']);
  });

  it('a member cannot add areas', async () => {
    await expectCode(
      w.data.createArea(w.as('max'), oak(), { name: 'Creek Bottom', boundary: POLYGON }),
      'forbidden',
    );
  });

  it('a member cannot rename areas', async () => {
    const [area] = await w.data.listAreas(SERVICE, oak());
    await expectCode(
      w.data.updateArea(w.as('max'), oak(), area!.id, { name: "Max's 40" }),
      'forbidden',
    );
  });

  it('an admin adds an area', async () => {
    const area = await w.data.createArea(w.as('ada'), oak(), {
      name: 'Creek Bottom',
      boundary: POLYGON,
    });
    expect(area).toMatchObject({ name: 'Creek Bottom', active: true, meshId: 2 });
  });

  it('the shared shape rule refuses an area that crosses itself', async () => {
    const bowTie = propertyLinePolygon([
      [-90, 40],
      [-89.99, 40.01],
      [-89.99, 40],
      [-90, 40.01],
    ]);
    await expectCode(
      w.data.createArea(w.as('ada'), oak(), { name: 'Bow Tie', boundary: bowTie }),
      'invalid',
    );
  });

  it('an expired guest sees no areas', async () => {
    await expectCode(w.data.listAreas(w.as('eve'), oak()), 'forbidden');
  });
});

describe('stands', () => {
  it("a guest reads their club's stands only", async () => {
    expect((await w.data.listStands(w.as('gus'), oak())).map((s) => s.name)).toEqual([
      'Creek Stand',
    ]);
    await expectCode(w.data.listStands(w.as('gus'), pine()), 'forbidden');
  });

  it('a member cannot add stands', async () => {
    await expectCode(w.data.createStand(w.as('max'), oak(), standAt('My Stand')), 'forbidden');
  });

  it('a member cannot change stands', async () => {
    const [stand] = await w.data.listStands(SERVICE, oak());
    await expectCode(
      w.data.updateStand(w.as('max'), oak(), stand!.id, { active: false }),
      'forbidden',
    );
  });

  it('a member cannot delete stands', async () => {
    const [stand] = await w.data.listStands(SERVICE, oak());
    await expectCode(w.data.deleteStand(w.as('max'), oak(), stand!.id), 'forbidden');
  });

  it('an admin adds a stand', async () => {
    const stand = await w.data.createStand(w.as('ada'), oak(), {
      name: 'Field Blind',
      type: 'ground_blind',
      lat: 40.002,
      lon: -89.998,
    });
    expect(stand).toMatchObject({ name: 'Field Blind', clubId: oak(), active: true });
  });

  it("an admin cannot edit another club's stands", async () => {
    const [ridge] = await w.data.listStands(SERVICE, pine());
    await expectCode(
      w.data.updateStand(w.as('ada'), pine(), ridge!.id, { notes: 'Moved' }),
      'forbidden',
    );
    // Nor through their own club: the stand isn't in Oak Ridge's partition.
    await expectCode(
      w.data.updateStand(w.as('ada'), oak(), ridge!.id, { notes: 'Moved' }),
      'not_found',
    );
  });

  it('an admin cannot add stands to another club', async () => {
    await expectCode(w.data.createStand(w.as('ada'), pine(), standAt('Planted')), 'forbidden');
  });

  it('a user in no club sees no stands', async () => {
    await expectCode(w.data.listStands(w.as('nora'), oak()), 'forbidden');
  });

  // New with DynamoDB: Postgres' "on delete set null" for stand.area_id.
  it("deleting an area clears its stands' area", async () => {
    const [north40] = (await w.data.listAreas(SERVICE, oak())).filter((a) => a.name === 'North 40');
    await w.data.deleteArea(w.as('ada'), oak(), north40!.id);
    const creek = (await w.data.listStands(SERVICE, oak())).find((s) => s.name === 'Creek Stand');
    expect(creek?.areaId).toBeUndefined();
  });
});
