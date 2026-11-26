/**
 * Shared test fixtures for MeshClient tests (here and in the app). Use these
 * instead of re-creating clients and radios in each test file.
 * Tests that use them must run with Jest fake timers (`tick`).
 */
import { MeshClient, type MeshClientOptions } from '../MeshClient';
import type { Emitter } from '../emitter';
import { decodeToRadio } from '../codec/radio';
import {
  FakeAir,
  FakeRadio,
  type FakeAirOptions,
  type FakeRadioOptions,
} from '../transports/FakeTransport';
import { seededRandom } from './seededRandom';

/** Node numbers used across tests. */
export const NODES: Readonly<{ alice: number; bob: number; carol: number; dave: number }> = {
  alice: 0xa11ce001,
  bob: 0xb0b00002,
  carol: 0xca401003,
  dave: 0xda7e0004,
};

/** Advances Jest fake timers and flushes microtasks. */
export const tick = (ms = 0): Promise<void> => jest.advanceTimersByTimeAsync(ms);

/** A client on `radio` with a deterministic random source seeded by the node number. */
export function createClient(radio: FakeRadio, opts: Partial<MeshClientOptions> = {}): MeshClient {
  return new MeshClient({ transport: radio, random: seededRandom(radio.nodeNum), ...opts });
}

/** A FakeRadio plus a client that has finished the handshake. */
export async function connectedClient(
  radioOpts: Partial<FakeRadioOptions> = {},
  clientOpts: Partial<MeshClientOptions> = {},
): Promise<{ radio: FakeRadio; client: MeshClient }> {
  const radio = new FakeRadio({ nodeNum: NODES.alice, ...radioOpts });
  const client = createClient(radio, clientOpts);
  await client.connect();
  await tick();
  return { radio, client };
}

/** Several radios on one FakeAir, each with a ready client (tuples keep their length). */
export async function connectedMesh<const T extends readonly FakeRadioOptions[]>(
  radios: T,
  opts: { air?: FakeAirOptions; client?: Partial<MeshClientOptions> } = {},
): Promise<{
  air: FakeAir;
  radios: { [K in keyof T]: FakeRadio };
  clients: { [K in keyof T]: MeshClient };
}> {
  const air = new FakeAir(opts.air);
  const fakeRadios = radios.map((r) => new FakeRadio(r));
  air.attach(...fakeRadios);
  const clients = fakeRadios.map((r) => createClient(r, opts.client));
  for (const c of clients) await c.connect();
  await tick();
  return {
    air,
    radios: fakeRadios as { [K in keyof T]: FakeRadio },
    clients: clients as { [K in keyof T]: MeshClient },
  };
}

/** Collects every payload of one event (MeshClient or any other Emitter) into an array. */
export function collect<E extends { [K in keyof E]: unknown }, K extends keyof E>(
  emitter: Emitter<E>,
  event: K,
): E[K][] {
  const out: E[K][] = [];
  emitter.on(event, (e) => out.push(e));
  return out;
}

/** Makes the radio record writes but never answer (no config dump, no acks). */
export function swallowWrites(radio: FakeRadio): void {
  radio.write = async (b) => {
    radio.writes.push(decodeToRadio(b));
  };
}
