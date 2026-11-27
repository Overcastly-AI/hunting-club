/**
 * Test harness: a party of radios on one FakeAir, each phone running the
 * core services. Shared by every core test file.
 */
import type { CalendarDay, SunApi } from '@huntclub/shared';
import { connectedMesh, NODES, seededRandom } from '@huntclub/mesh/testing';
import type { FakeAirOptions, FakeRadio, FakeRadioOptions } from '@huntclub/mesh/testing';
import {
  HUNTCLUB_PORT,
  generatePartyChannelSet,
  decodeAppMessage,
  encodeJoinUrl,
  type AppMessage,
  type AppMessageType,
  type ChannelSet,
  type MeshClient,
  type MeshClientOptions,
} from '@huntclub/mesh';
import type { FakeAir } from '@huntclub/mesh/testing';
import { CheckInBoard, CheckInController } from '../checkIn';
import type { StoredParty } from '../partyStore';
import { DeliveryTracker, ReceiptService, type ReceiptPolicy } from '../receipts';

/** A fixed test location (central Minnesota). */
export const HOME = { lat: 46.0, lon: -94.0 } as const;

/**
 * Deterministic SunApi for tests: sunset every UTC day at `sunsetUtcHour`,
 * sunrise ten hours earlier, calendar days in UTC. The real calculation is `SUN` in ../sun.ts.
 */
export function fixedSun(
  sunsetUtcHour = 23,
  polar: 'polarDay' | 'polarNight' | null = null,
): SunApi {
  return {
    localCalendarDay: (d: Date): CalendarDay => ({
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
    }),
    sunTimes: (day: CalendarDay) =>
      polar
        ? { kind: polar }
        : {
            kind: 'normal',
            sunrise: new Date(Date.UTC(day.year, day.month - 1, day.day, sunsetUtcHour - 10)),
            sunset: new Date(Date.UTC(day.year, day.month - 1, day.day, sunsetUtcHour)),
          },
  };
}

export interface Phone {
  radio: FakeRadio;
  client: MeshClient;
  checkIns: CheckInController;
  board: CheckInBoard;
  receipts: ReceiptService;
  delivery: DeliveryTracker;
  /** The context the services were built with (deterministic random). */
  ctx: { client: MeshClient; random: ReturnType<typeof seededRandom> };
}

/** Alice, Bob and (optionally) Carol, connected over FakeAir, with receipts running. */
export async function party(
  opts: {
    size?: 2 | 3 | 4;
    /** Each radio starts on its own private channel (nobody hears anybody until they share a party). */
    separateChannels?: boolean;
    air?: FakeAirOptions;
    receipts?: Partial<ReceiptPolicy>;
    clubModes?: boolean;
    /** Extra options for every phone's MeshClient and every FakeRadio. */
    client?: Partial<MeshClientOptions>;
    radio?: Partial<FakeRadioOptions>;
  } = {},
): Promise<{ phones: Phone[]; air: Awaited<ReturnType<typeof connectedMesh>>['air'] }> {
  const nodes = [NODES.alice, NODES.bob, NODES.carol, NODES.dave].slice(0, opts.size ?? 3);
  const mesh = await connectedMesh(
    nodes.map((nodeNum) =>
      opts.separateChannels
        ? {
            ...opts.radio,
            nodeNum,
            channels: generatePartyChannelSet({ random: seededRandom(nodeNum), name: 'Solo' })
              .settings,
          }
        : { ...opts.radio, nodeNum },
    ),
    { ...(opts.air ? { air: opts.air } : {}), ...(opts.client ? { client: opts.client } : {}) },
  );
  const phones = mesh.clients.map((client, i) => {
    const ctx = { client, random: seededRandom(nodes[i]! ^ 0x5eed) };
    return {
      radio: mesh.radios[i]!,
      client,
      checkIns: new CheckInController(ctx, { clubModes: opts.clubModes ?? false }),
      board: new CheckInBoard(ctx),
      receipts: new ReceiptService(ctx, opts.receipts).start(),
      delivery: new DeliveryTracker(client),
      ctx,
    };
  });
  return { phones, air: mesh.air };
}

/** Start time used by tests: 2026-11-26 14:00 UTC (sunset in fixedSun() is 23:00 UTC). */
export const T0 = Date.UTC(2026, 10, 26, 14);

/** App messages of one type that went over the air, decoded, in order. */
export function onAir<T extends AppMessageType>(
  air: FakeAir,
  type: T,
): Extract<AppMessage, { type: T }>[] {
  return air.log
    .filter((p) => Number(p.data.portnum) === HUNTCLUB_PORT)
    .map((p) => decodeAppMessage(p.data.payload))
    .filter((m): m is Extract<AppMessage, { type: T }> => m.type === type);
}

/** A saved party on `channelSet` (its join link holds the key), as PartyStore keeps it. */
export function savedParty(
  channelSet: ChannelSet,
  overrides: Partial<StoredParty> = {},
): StoredParty {
  const id = overrides.id ?? 'partyAAA';
  return {
    id,
    joinLink: encodeJoinUrl({ channelSet, target: { kind: 'party', partyId: id } }),
    role: 'creator',
    joinedAt: T0,
    channelIndex: 0,
    members: [],
    ...overrides,
  };
}
