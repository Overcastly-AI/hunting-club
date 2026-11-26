// Port of supabase/tests/database/45_mesh_ids.test.sql: radio ids for stands and
// areas are server-assigned, per club and kind, from 1, never reused, immutable.
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { SERVICE } from '../index';
import { ATTR, keys } from '../items';
import { POLYGON, World, expectCode } from '../testing/world';

let w: World;
beforeAll(async () => {
  w = await World.seedTwoClubs();
});
afterAll(() => w.destroy());

const oak = () => w.club('Oak Ridge');
const stand = (name: string) => ({ name, type: 'ladder' as const, lat: 40, lon: -90 });
const meshIds = async (clubId: string) =>
  (await w.data.listStands(SERVICE, clubId)).map((s) => s.meshId).sort((a, b) => a - b);
const standNamed = async (name: string) =>
  (await w.data.listStands(SERVICE, oak())).find((s) => s.name === name)!;

it('stands get sequential ids from 1, and a client cannot supply a mesh id', async () => {
  await expectCode(
    w.data.createStand(w.as('ada'), oak(), { ...stand('Spoofed'), meshId: 999 } as never),
    'invalid',
  );
  await w.data.createStand(w.as('ada'), oak(), stand('Spoofed'));
  await w.data.createStand(w.as('ada'), oak(), { ...stand('Third'), type: 'ground_blind' });
  expect(await meshIds(oak())).toEqual([1, 2, 3]);
});

it('the next id goes to the next stand (999 was never used)', async () => {
  expect((await standNamed('Spoofed')).meshId).toBe(2);
});

it('areas count separately from stands', async () => {
  const [north40] = await w.data.listAreas(SERVICE, oak());
  expect(north40?.meshId).toBe(1);
});

it('an admin cannot change a mesh id', async () => {
  const third = await standNamed('Third');
  await expectCode(
    w.data.updateStand(w.as('ada'), oak(), third.id, { meshId: 7 } as never),
    'invalid',
  );
  expect((await standNamed('Third')).meshId).toBe(3);
});

it('a stand cannot move to another club', async () => {
  const third = await standNamed('Third');
  await expectCode(
    w.data.updateStand(w.as('ada'), oak(), third.id, { clubId: w.club('Pine Hollow') } as never),
    'invalid',
  );
});

it("a deleted stand's id is never reused", async () => {
  await w.data.deleteStand(w.as('ada'), oak(), (await standNamed('Third')).id);
  const fourth = await w.data.createStand(w.as('ada'), oak(), stand('Fourth'));
  expect(fourth.meshId).toBe(4);
});

it('each club has its own sequence', async () => {
  expect(await meshIds(w.club('Pine Hollow'))).toEqual([1]);
});

it('clients never see or set the counters', async () => {
  for (const s of await w.data.listStands(w.as('max'), oak())) {
    expect(s).not.toHaveProperty('lastValue');
  }
  expect(w.data).not.toHaveProperty('allocateMeshId');
  // The counter items exist only in the table, keyed apart from stands.
  const { Items } = await w.raw.send(
    new QueryCommand({
      TableName: w.tableName,
      KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :sk)',
      ExpressionAttributeNames: { '#pk': ATTR.PK, '#sk': ATTR.SK },
      ExpressionAttributeValues: { ':pk': keys.club(oak())[ATTR.PK], ':sk': 'MESHID#' },
    }),
  );
  expect(Items?.map((i) => [i[ATTR.SK], i.lastValue])).toEqual([
    ['MESHID#AREA', 1],
    ['MESHID#STAND', 4],
  ]);
});

it('stand mesh ids are unique within a club, even when created concurrently', async () => {
  await Promise.all(
    Array.from({ length: 20 }, (_, i) => w.data.createStand(SERVICE, oak(), stand(`Race ${i}`))),
  );
  const ids = await meshIds(oak());
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).toEqual([1, 2, ...Array.from({ length: 21 }, (_, i) => i + 4)]);
});

it('area mesh ids are unique within a club, even when created concurrently', async () => {
  await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      w.data.createArea(SERVICE, oak(), { name: `Zone ${i}`, boundary: POLYGON }),
    ),
  );
  const ids = (await w.data.listAreas(SERVICE, oak())).map((a) => a.meshId).sort((a, b) => a - b);
  expect(ids).toEqual(Array.from({ length: 11 }, (_, i) => i + 1));
});
