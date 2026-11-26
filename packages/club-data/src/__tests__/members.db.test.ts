// Port of supabase/tests/database/20_club_members.test.sql: the roster, the
// profile/role guard and the keep-one-admin rule.
import { ANONYMOUS, SERVICE } from '../index';
import { World, expectCode, profile } from '../testing/world';

let w: World;
beforeAll(async () => {
  w = await World.seedTwoClubs();
});
afterAll(() => w.destroy());

const oak = () => w.club('Oak Ridge');
const names = async (actor = SERVICE) =>
  (await w.data.listMembers(actor, oak())).map((m) => m.displayName).sort();
const newbie = () => ({ userId: w.user('newbie'), ...profile('newbie') });

it("a member reads their club's roster only", async () => {
  expect(await names(w.as('max'))).toEqual(['ada', 'eve', 'gus', 'max']);
  await expectCode(w.data.listMembers(w.as('max'), w.club('Pine Hollow')), 'forbidden');
});

it('a member cannot add members', async () => {
  await expectCode(w.data.addMember(w.as('max'), oak(), newbie()), 'forbidden');
});

it('a member edits their own name and radio', async () => {
  const me = await w.data.updateMemberProfile(w.as('max'), oak(), w.user('max'), {
    displayName: 'Maxine',
    nodeId: 305419896,
  });
  expect(me).toMatchObject({ displayName: 'Maxine', nodeId: 305419896, role: 'member' });
});

it('a member cannot promote themselves', async () => {
  await expectCode(
    w.data.setMemberAccess(w.as('max'), oak(), w.user('max'), { role: 'admin' }),
    'forbidden',
  );
  await expectCode(
    w.data.updateMemberProfile(w.as('max'), oak(), w.user('max'), {
      role: 'admin',
    } as never),
    'invalid',
  );
});

it('a member cannot edit someone else', async () => {
  await expectCode(
    w.data.updateMemberProfile(w.as('max'), oak(), w.user('ada'), { displayName: 'Hacked' }),
    'forbidden',
  );
});

it('a member cannot remove someone else', async () => {
  await expectCode(w.data.removeMember(w.as('max'), oak(), w.user('gus')), 'forbidden');
  expect(await names()).toContain('gus');
});

it('a guest with a valid pass reads the roster', async () => {
  expect(await w.data.listMembers(w.as('gus'), oak())).toHaveLength(4);
});

it('an expired guest reads nothing', async () => {
  await expectCode(w.data.listMembers(w.as('eve'), oak()), 'forbidden');
});

it("another club's admin cannot read this roster", async () => {
  await expectCode(w.data.listMembers(w.as('pat'), oak()), 'forbidden');
});

it("another club's admin cannot add members here", async () => {
  await expectCode(w.data.addMember(w.as('pat'), oak(), newbie()), 'forbidden');
});

it('an admin adds a member', async () => {
  const added = await w.data.addMember(w.as('ada'), oak(), newbie());
  expect(added.role).toBe('member');
});

it('an admin promotes a member', async () => {
  const promoted = await w.data.setMemberAccess(w.as('ada'), oak(), w.user('newbie'), {
    role: 'admin',
  });
  expect(promoted.role).toBe('admin');
});

it('an admin can step down while another admin remains', async () => {
  const ada = await w.data.setMemberAccess(w.as('ada'), oak(), w.user('ada'), { role: 'member' });
  expect(ada.role).toBe('member');
});

it('the last admin cannot step down', async () => {
  await expectCode(
    w.data.setMemberAccess(w.as('newbie'), oak(), w.user('newbie'), { role: 'member' }),
    'last_admin',
  );
});

it('the last admin cannot leave', async () => {
  await expectCode(w.data.removeMember(w.as('newbie'), oak(), w.user('newbie')), 'last_admin');
  expect(await names()).toContain('newbie');
});

it('a member can leave the club', async () => {
  await w.data.removeMember(w.as('max'), oak(), w.user('max'));
  expect(await names()).not.toContain('Maxine');
});

it('anonymous users cannot read rosters', async () => {
  await expectCode(w.data.listMembers(ANONYMOUS, oak()), 'not_authenticated');
});
