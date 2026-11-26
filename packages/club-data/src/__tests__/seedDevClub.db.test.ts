// The dev test club seed: creates the club once, then only refreshes it.
import { ENTITLEMENT_GRACE_DAYS } from '@huntclub/shared';
import { SERVICE, UAT_CLUB, seedDevClub, userActor } from '../index';
import { World } from '../testing/world';

let w: World;
const ADMIN = '00000000-0000-4000-8000-00000000a001';
const input = () => ({ adminSub: ADMIN, email: 'jane.doe@example.com', now: w.clock.now() });

beforeEach(async () => {
  w = await World.create();
});
afterEach(() => w.destroy());

it('creates the UAT club with the admin, a property line, one area and three stands', async () => {
  const result = await seedDevClub(w.data, input());
  expect(result.created).toBe(true);

  const [mine] = await w.data.listMyClubs(userActor(ADMIN));
  expect(mine).toMatchObject({
    club: { id: result.clubId, name: UAT_CLUB.name, boundary: UAT_CLUB.boundary },
    membership: { role: 'admin', displayName: 'Jane Doe', initials: 'JD' },
  });
  const areas = await w.data.listAreas(SERVICE, result.clubId);
  const stands = await w.data.listStands(SERVICE, result.clubId);
  expect(areas.map((a) => a.name)).toEqual([UAT_CLUB.area]);
  expect(stands.map((s) => s.name).sort()).toEqual(UAT_CLUB.stands.map((s) => s.name).sort());
  expect(stands.filter((s) => s.areaId === areas[0]!.id)).toHaveLength(2);
});

it('gives the club features for 90 days from the day it runs', async () => {
  const { featuresUntil } = await seedDevClub(w.data, input());
  const days = (Date.parse(featuresUntil!) - w.clock.now().getTime()) / 86_400_000;
  expect(Math.round(days)).toBe(UAT_CLUB.featureDays);
  expect(UAT_CLUB.featureDays).toBeGreaterThan(ENTITLEMENT_GRACE_DAYS);
});

it('is idempotent: a second run updates the same club and adds nothing', async () => {
  const first = await seedDevClub(w.data, input());
  w.clock.advance(60_000);
  const second = await seedDevClub(w.data, input());
  expect(second).toMatchObject({ clubId: first.clubId, created: false });
  expect(Date.parse(second.featuresUntil!)).toBeGreaterThan(Date.parse(first.featuresUntil!));
  expect(await w.data.listMyClubs(userActor(ADMIN))).toHaveLength(1);
  expect(await w.data.listAreas(SERVICE, first.clubId)).toHaveLength(1);
  expect(await w.data.listStands(SERVICE, first.clubId)).toHaveLength(UAT_CLUB.stands.length);
});
