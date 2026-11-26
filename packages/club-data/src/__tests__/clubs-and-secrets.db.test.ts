// Port of supabase/tests/database/10_clubs_and_secrets.test.sql.
import { ANONYMOUS, SERVICE } from '../index';
import { World, expectCode, keyOf, profile } from '../testing/world';

let w: World;
beforeAll(async () => {
  w = await World.seedTwoClubs();
});
afterAll(() => w.destroy());

const oak = () => w.club('Oak Ridge');
const pine = () => w.club('Pine Hollow');

describe('clubs', () => {
  it('a member sees only their own club', async () => {
    const mine = await w.data.listMyClubs(w.as('max'));
    expect(mine.map((c) => c.club.name)).toEqual(['Oak Ridge']);
    expect((await w.data.getClub(w.as('max'), oak())).name).toBe('Oak Ridge');
    await expectCode(w.data.getClub(w.as('max'), pine()), 'forbidden');
  });

  it('a member cannot rename the club', async () => {
    await expectCode(w.data.updateClub(w.as('max'), oak(), { name: 'Max Ridge' }), 'forbidden');
    expect((await w.data.getClub(SERVICE, oak())).name).toBe('Oak Ridge');
  });

  it('a member cannot create clubs (provisioning Lambda only)', async () => {
    await expectCode(
      w.data.createClub(w.as('max'), {
        club: { name: 'Rogue Club' },
        admin: { userId: w.user('max'), ...profile('max') },
      }),
      'forbidden',
    );
  });

  it('an admin updates their club', async () => {
    const club = await w.data.updateClub(w.as('ada'), oak(), { overdueGraceMinutes: 45 });
    expect(club.overdueGraceMinutes).toBe(45);
    expect(club.name).toBe('Oak Ridge');
  });

  it('an admin cannot update another club', async () => {
    await expectCode(w.data.updateClub(w.as('ada'), pine(), { name: 'Mine' }), 'forbidden');
  });

  it('an admin cannot delete the club (service only)', async () => {
    await expectCode(w.data.deleteClub(w.as('ada'), oak()), 'forbidden');
    expect((await w.data.getClub(SERVICE, oak())).id).toBe(oak());
  });

  it('a signed-in non-member sees no clubs', async () => {
    expect(await w.data.listMyClubs(w.as('nora'))).toEqual([]);
    await expectCode(w.data.getClub(w.as('nora'), oak()), 'forbidden');
  });

  it('an expired guest sees no clubs', async () => {
    expect(await w.data.listMyClubs(w.as('eve'))).toEqual([]);
    await expectCode(w.data.getClub(w.as('eve'), oak()), 'forbidden');
  });

  it('anonymous users cannot read clubs', async () => {
    await expectCode(w.data.getClub(ANONYMOUS, oak()), 'not_authenticated');
    await expectCode(w.data.listMyClubs(ANONYMOUS), 'not_authenticated');
  });
});

describe('club secret (radio key)', () => {
  it("an admin reads their own club's key and no other", async () => {
    const secret = await w.data.getClubSecret(w.as('ada'), oak());
    expect(secret.channelKey).toHaveLength(32);
    await expectCode(w.data.getClubSecret(w.as('ada'), pine()), 'forbidden');
  });

  it("an admin resets their club's key", async () => {
    const before = await w.data.getClubSecret(w.as('ada'), oak());
    const after = await w.data.setClubSecret(w.as('ada'), oak(), keyOf('ef'));
    expect(after.channelKey).toEqual(keyOf('ef'));
    expect(after.keyVersion).toBe(before.keyVersion + 1);
  });

  it('a member cannot read the club key', async () => {
    await expectCode(w.data.getClubSecret(w.as('max'), oak()), 'forbidden');
  });

  it('a member cannot change the club key', async () => {
    await expectCode(w.data.setClubSecret(w.as('max'), oak(), keyOf('00')), 'forbidden');
    expect((await w.data.getClubSecret(SERVICE, oak())).channelKey).toEqual(keyOf('ef'));
  });

  it('a guest cannot read the club key', async () => {
    await expectCode(w.data.getClubSecret(w.as('gus'), oak()), 'forbidden');
  });

  it("another club's admin cannot write this club's key", async () => {
    await expectCode(w.data.setClubSecret(w.as('pat'), oak(), keyOf('11')), 'forbidden');
  });

  it('the service reads every key (Lambdas)', async () => {
    expect((await w.data.getClubSecret(SERVICE, oak())).channelKey).toEqual(keyOf('ef'));
    expect((await w.data.getClubSecret(SERVICE, pine())).channelKey).toEqual(keyOf('cd'));
  });
});
