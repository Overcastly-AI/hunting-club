// Port of supabase/tests/database/00_schema.test.sql: structure, validation rules and
// cascades every other test relies on.
import { DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { MEMBER_ROLES, STAND_TYPES } from '@huntclub/shared';
import * as api from '../index';
import { ANONYMOUS, SERVICE, can } from '../index';
import { ATTR, epochSeconds, keys } from '../items';
import { GSIS, TABLE_KEYS, TTL_ATTRIBUTE } from '../table';
import { World, expectCode, keyOf } from '../testing/world';

let w: World;
beforeAll(async () => {
  w = await World.seedTwoClubs();
});
afterAll(() => w.destroy());

const oak = () => w.club('Oak Ridge');
const pine = () => w.club('Pine Hollow');

describe('structure', () => {
  it('every club operation refuses anonymous callers (was: every table has RLS)', async () => {
    const ops = Object.keys(w.data).filter((op) => op !== 'listPlans') as (keyof typeof w.data)[];
    for (const op of ops) {
      const call = (w.data[op] as (...a: unknown[]) => Promise<unknown>)(
        ANONYMOUS,
        oak(),
        oak(),
        oak(),
      );
      // Authorization runs before validation or lookups, so the code is always the same.
      await expectCode(call, 'not_authenticated');
    }
  });

  it('the table has exactly the keys and indexes from table.ts (was: tables_are)', async () => {
    const { Table } = await w.raw.send(new DescribeTableCommand({ TableName: w.tableName }));
    expect(Table?.KeySchema?.map((k) => k.AttributeName)).toEqual([
      TABLE_KEYS.partitionKey,
      TABLE_KEYS.sortKey,
    ]);
    expect(Table?.GlobalSecondaryIndexes?.map((g) => g.IndexName)).toEqual(
      Object.values(GSIS).map((g) => g.indexName),
    );
  });

  it('stand types match the spec', () => {
    expect(STAND_TYPES).toEqual(['tree_stand', 'ladder', 'ground_blind']);
  });

  it('member roles match the spec', () => {
    expect(MEMBER_ROLES).toEqual(['admin', 'member', 'guest']);
  });

  it('membership lookups and raw writes are not part of the package API', () => {
    for (const internal of ['getMember', 'accessTo', 'transact', 'put', 'allocateMeshId']) {
      expect(api).not.toHaveProperty(internal);
      expect(w.data).not.toHaveProperty(internal);
    }
  });

  it('membership rule: an active member or unexpired guest counts, an expired guest does not', () => {
    const now = w.clock.now();
    const member = (expiresAt?: string) => ({
      actor: w.as('x'),
      now,
      membership: {
        clubId: oak(),
        userId: w.user('x'),
        displayName: 'x',
        initials: 'X',
        role: 'guest' as const,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        ...(expiresAt ? { expiresAt } : {}),
      },
    });
    expect(can(member(), 'readClub')).toBe(true);
    expect(can(member(w.clock.inDays(1)), 'readClub')).toBe(true);
    expect(can(member(w.clock.inDays(-1)), 'readClub')).toBe(false);
  });

  it('admin rule: only admins pass admin policies; the service passes all', () => {
    const now = w.clock.now();
    const access = (role: 'admin' | 'member') => ({
      actor: w.as('y'),
      now,
      membership: {
        clubId: oak(),
        userId: w.user('y'),
        displayName: 'y',
        initials: 'Y',
        role,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    });
    expect(can(access('admin'), 'writePlaces')).toBe(true);
    expect(can(access('member'), 'writePlaces')).toBe(false);
    expect(can({ actor: SERVICE, now, membership: undefined }, 'writePlaces')).toBe(true);
  });

  it('stands live in their club partition (was: stands indexed by club_id)', () => {
    expect(keys.inClub(oak(), 'stand', 's')[ATTR.PK]).toBe(keys.club(oak())[ATTR.PK]);
  });

  it('harvests live in their club partition (was: harvests indexed by club_id)', () => {
    expect(keys.inClub(oak(), 'harvest', 'h')[ATTR.PK]).toBe(keys.club(oak())[ATTR.PK]);
  });

  it('members live in their club partition and are indexed by user', async () => {
    const { Item } = await w.raw.send(
      new GetCommand({ TableName: w.tableName, Key: keys.inClub(oak(), 'member', w.user('max')) }),
    );
    expect(Item?.[ATTR.PK]).toBe(keys.club(oak())[ATTR.PK]);
    expect(Item?.[ATTR.GPK]).toBe(`USER#${w.user('max')}`);
  });
});

describe('validation', () => {
  it('channel key must be exactly 32 bytes', async () => {
    await expectCode(w.data.setClubSecret(SERVICE, oak(), Uint8Array.of(1, 2)), 'invalid');
    expect((await w.data.getClubSecret(SERVICE, oak())).channelKey).toEqual(keyOf('ab'));
  });

  it('stand latitude must be valid', async () => {
    await expectCode(
      w.data.createStand(SERVICE, oak(), { name: 'Nowhere', type: 'ladder', lat: 91, lon: 0 }),
      'invalid',
    );
  });

  it('stand type must be a known type', async () => {
    await expectCode(
      w.data.createStand(SERVICE, oak(), {
        name: 'Bad Type',
        type: 'hammock' as 'ladder',
        lat: 40,
        lon: -90,
      }),
      'invalid',
    );
  });

  it('area boundary must be a GeoJSON polygon', async () => {
    await expectCode(
      w.data.createArea(SERVICE, oak(), {
        name: 'Pointy',
        boundary: { type: 'Point' as 'Polygon', coordinates: [0, 0] },
      }),
      'invalid',
    );
  });

  it("a stand cannot sit in another club's area", async () => {
    const [north40] = await w.data.listAreas(SERVICE, oak());
    await expectCode(
      w.data.createStand(SERVICE, pine(), {
        name: 'Stolen',
        type: 'ladder',
        lat: 40,
        lon: -90,
        areaId: north40!.id,
      }),
      'invalid',
    );
  });

  it("a harvest's hunter must belong to the same club", async () => {
    await expectCode(
      w.data.createHarvest(w.as('max'), pine(), {
        species: 'turkey',
        harvestedAt: w.clock.inDays(0),
      }),
      'forbidden',
    );
  });

  it('admins cannot have an expiry (only guest passes expire)', async () => {
    await expectCode(
      w.data.addMember(SERVICE, oak(), {
        userId: w.user('temp'),
        displayName: 'Temp',
        initials: 'TA',
        role: 'admin',
        expiresAt: w.clock.inDays(1),
      }),
      'invalid',
    );
  });

  it('invites cannot grant admin', async () => {
    await expectCode(
      w.data.createInvite(SERVICE, oak(), {
        role: 'admin' as 'member',
        expiresAt: w.clock.inDays(1),
      }),
      'invalid',
    );
  });

  it('a user joins a club at most once', async () => {
    await expectCode(
      w.data.addMember(SERVICE, oak(), {
        userId: w.user('max'),
        displayName: 'Max again',
        initials: 'MX',
      }),
      'conflict',
    );
  });

  it('invite tokens are 256 bits of hex', async () => {
    expect(await w.createInvite('Oak Ridge')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('updatedAt is set on update', async () => {
    const [stand] = await w.data.listStands(SERVICE, oak());
    w.clock.advance(1000);
    const updated = await w.data.updateStand(SERVICE, oak(), stand!.id, {
      notes: 'Climber on the oak',
    });
    expect(updated.updatedAt > stand!.updatedAt).toBe(true);
    expect(updated.createdAt).toBe(stand!.createdAt);
  });

  it('guest passes carry a TTL at their expiry; members and admins do not', async () => {
    const get = (user: string) =>
      w.raw.send(
        new GetCommand({ TableName: w.tableName, Key: keys.inClub(oak(), 'member', w.user(user)) }),
      );
    const gus = (await get('gus')).Item!;
    const [gusMember] = (await w.data.listMembers(SERVICE, oak())).filter(
      (m) => m.displayName === 'gus',
    );
    expect(gus[TTL_ATTRIBUTE]).toBe(epochSeconds(gusMember!.expiresAt!));
    expect(typeof gus[TTL_ATTRIBUTE]).toBe('number');
    expect((await get('max')).Item![TTL_ATTRIBUTE]).toBeUndefined();
  });
});

describe('cascade', () => {
  it('deleting a club removes everything it owns, even its last admin', async () => {
    await w.data.deleteClub(SERVICE, pine());
    expect(await w.data.listMyClubs(w.as('pat'))).toEqual([]);
    await expectCode(w.data.getClub(SERVICE, pine()), 'not_found');
    await expectCode(w.data.listMembers(w.as('pat'), pine()), 'forbidden');
    expect(await w.data.listMembers(SERVICE, pine())).toEqual([]);
    expect(await w.data.listStands(SERVICE, pine())).toEqual([]);
    expect(await w.data.getSubscription(SERVICE, pine())).toBeNull();
    await expectCode(w.data.getClubSecret(SERVICE, pine()), 'not_found');
  });
});
