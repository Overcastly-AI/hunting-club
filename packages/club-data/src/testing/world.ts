/**
 * Shared fixtures for the DynamoDB Local tests (the port of supabase's
 * tests.seed_two_clubs() and friends). Every test file builds its world here
 * instead of writing items by hand. Each world gets its own fresh table.
 */
import { randomUUID } from 'node:crypto';
import { CreateTableCommand, DeleteTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { ClubApiError, InviteCreate, MemberRole, SubscriptionStatus } from '@huntclub/shared';
import { type Actor, SERVICE, userActor } from '../actor';
import { createClubData, type ClubData } from '../index';
import { DOCUMENT_CLIENT_OPTIONS } from '../db';
import { createTableInput } from '../localTable';

export const DYNAMODB_ENDPOINT = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A test clock: starts at the real time and only moves when told to. */
export class TestClock {
  private ms = Date.now();
  now = () => new Date(this.ms);
  advance(ms: number) {
    this.ms += ms;
  }
  /** ISO timestamp `days` from now (negative = past). */
  inDays(days: number) {
    return new Date(this.ms + days * DAY_MS).toISOString();
  }
}

export const POLYGON = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [-90, 40],
      [-90, 40.01],
      [-89.99, 40.01],
      [-90, 40],
    ],
  ],
};

export const keyOf = (hexByte: string) => Uint8Array.from(Buffer.from(hexByte.repeat(32), 'hex'));

/** Asserts a club-data call fails with this error code. */
export async function expectCode(promise: Promise<unknown>, code: ClubApiError) {
  await expect(promise).rejects.toMatchObject({ name: 'ClubDataError', code });
}

export class World {
  readonly clock = new TestClock();
  readonly raw: DynamoDBDocumentClient;
  readonly data: ClubData;
  private readonly users = new Map<string, string>();
  private readonly clubs = new Map<string, string>();

  private constructor(readonly tableName: string) {
    const client = new DynamoDBClient({
      endpoint: DYNAMODB_ENDPOINT,
      region: 'us-east-1',
      credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
    });
    this.raw = DynamoDBDocumentClient.from(client, DOCUMENT_CLIENT_OPTIONS);
    this.data = createClubData({ client: this.raw, tableName, now: this.clock.now });
  }

  /** A new empty table with the placeholder plans seeded. */
  static async create(): Promise<World> {
    const world = new World(`club-data-test-${randomUUID()}`);
    await world.raw.send(new CreateTableCommand(createTableInput(world.tableName)));
    await world.data.seedPlans(SERVICE);
    return world;
  }

  async destroy() {
    await this.raw.send(new DeleteTableCommand({ TableName: this.tableName }));
    this.raw.destroy();
  }

  /** The user id for a test username (created on first use). */
  user(name: string): string {
    let id = this.users.get(name);
    if (!id) {
      id = randomUUID();
      this.users.set(name, id);
    }
    return id;
  }

  as(name: string): Actor {
    return userActor(this.user(name));
  }

  club(name: string): string {
    const id = this.clubs.get(name);
    if (!id) throw new Error(`unknown test club ${name}`);
    return id;
  }

  /** A provisioned club: club, first admin and a Stripe-synced subscription. */
  async createClub(
    name: string,
    adminName: string,
    options: { plan?: string; status?: SubscriptionStatus } = {},
  ): Promise<string> {
    const club = await this.data.createClub(SERVICE, {
      club: { name },
      admin: { userId: this.user(adminName), ...profile(adminName) },
    });
    this.clubs.set(name, club.id);
    await this.data.applyStripeEvent(SERVICE, {
      eventId: `evt_${randomUUID().replaceAll('-', '')}`,
      clubId: club.id,
      stripeCustomerId: `cus_${club.id}`,
      stripeSubscriptionId: `sub_${club.id}`,
      planId: options.plan ?? 'club_standard',
      status: options.status ?? 'active',
      paidThrough: this.clock.inDays(365),
    });
    return club.id;
  }

  addMember(clubName: string, name: string, role: MemberRole = 'member', expiresAt?: string) {
    return this.data.addMember(SERVICE, this.club(clubName), {
      userId: this.user(name),
      ...profile(name),
      role,
      ...(expiresAt ? { expiresAt } : {}),
    });
  }

  createArea(clubName: string, name: string) {
    return this.data.createArea(SERVICE, this.club(clubName), { name, boundary: POLYGON });
  }

  createStand(clubName: string, name: string, areaId?: string) {
    return this.data.createStand(SERVICE, this.club(clubName), {
      name,
      type: 'tree_stand',
      lat: 40.005,
      lon: -89.995,
      ...(areaId ? { areaId } : {}),
    });
  }

  createHarvest(clubName: string, hunter: string, shared: boolean) {
    return this.data.createHarvest(this.as(hunter), this.club(clubName), {
      species: 'whitetail',
      sex: 'male',
      harvestedAt: this.clock.inDays(0),
      shared,
    });
  }

  async createInvite(clubName: string, invite: Partial<InviteCreate> = {}): Promise<string> {
    const created = await this.data.createInvite(SERVICE, this.club(clubName), {
      expiresAt: this.clock.inDays(7),
      ...invite,
    });
    return created.token;
  }

  /**
   * The standard world used by most tests:
   *   club "Oak Ridge": admin "ada", member "max", guest "gus" (valid pass),
   *                     expired guest "eve", area "North 40", stand "Creek Stand"
   *   club "Pine Hollow": admin "pat" (an outsider to Oak Ridge), stand "Ridge Ladder"
   *   "nora": signed-in user in no club
   *   both clubs have a radio key
   */
  static async seedTwoClubs(): Promise<World> {
    const world = await World.create();
    await world.createClub('Oak Ridge', 'ada');
    await world.createClub('Pine Hollow', 'pat');
    await world.addMember('Oak Ridge', 'max');
    await world.addMember('Oak Ridge', 'gus', 'guest', world.clock.inDays(1));
    await world.addMember('Oak Ridge', 'eve', 'guest', world.clock.inDays(-1));
    const north40 = await world.createArea('Oak Ridge', 'North 40');
    await world.createStand('Oak Ridge', 'Creek Stand', north40.id);
    await world.createStand('Pine Hollow', 'Ridge Ladder');
    world.user('nora');
    await world.data.setClubSecret(SERVICE, world.club('Oak Ridge'), keyOf('ab'));
    await world.data.setClubSecret(SERVICE, world.club('Pine Hollow'), keyOf('cd'));
    return world;
  }
}

/** Display name = username; initials = first two letters, upper-cased. */
export function profile(name: string) {
  return { displayName: name, initials: name.slice(0, 2).toUpperCase() };
}
