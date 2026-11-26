/**
 * Where the integration tests find their radios.
 *
 *   MESH_SIM_NODES=127.0.0.1:4403,127.0.0.1:4404   real meshtasticd --sim nodes
 *   MESH_SIM_NODES=fake                            in-process FakeRadios over TCP (checks the tests themselves)
 *   (unset)                                        integration tests are skipped
 */
import { MeshClient } from '../MeshClient';
import { FakeAir, FakeRadio } from '../transports/FakeTransport';
import { NODES } from '../testing/fixtures';
import { seededRandom } from '../testing/seededRandom';
import { tcpTransport } from '../node/tcp';
import { serveFakeRadioTcp, type FakeRadioServer } from '../node/fakeServer';

export const SIM_SPEC = process.env.MESH_SIM_NODES ?? '';
export const SIM_ENABLED = SIM_SPEC !== '';
export const SIM_IS_FAKE = SIM_SPEC === 'fake';

export interface SimNode {
  host: string;
  port: number;
}

let fakeServers: FakeRadioServer[] = [];

/** Resolves the node list, starting fake servers when asked to. */
export async function simNodes(): Promise<SimNode[]> {
  if (!SIM_IS_FAKE) {
    return SIM_SPEC.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const [host, port] = s.split(':');
        return { host: host || '127.0.0.1', port: Number(port) };
      });
  }
  const air = new FakeAir();
  const radios = [NODES.alice, NODES.bob].map((nodeNum) => new FakeRadio({ nodeNum }));
  air.attach(...radios);
  radios.forEach((r) => r.dropLink());
  fakeServers = await Promise.all(radios.map((r) => serveFakeRadioTcp(r)));
  return fakeServers.map((s) => ({ host: '127.0.0.1', port: s.port }));
}

export async function stopSim(): Promise<void> {
  await Promise.all(fakeServers.map((s) => s.close()));
  fakeServers = [];
}

/** A connected, handshaken client (retries while meshtasticd restarts). */
export async function connectClient(
  node: SimNode,
  seed: number,
  readyTimeoutMs = 90_000,
): Promise<MeshClient> {
  const client = new MeshClient({
    transport: tcpTransport({ ...node, reconnect: { initialMs: 500, maxMs: 5_000 } }),
    random: seededRandom(seed),
    handshakeTimeoutMs: 15_000,
  });
  const deadline = Date.now() + readyTimeoutMs;
  for (;;) {
    try {
      await client.connect();
      break;
    } catch (e) {
      if (Date.now() > deadline) throw e;
      await sleep(1_000);
    }
  }
  await withTimeout(
    client.waitUntilReady(),
    deadline - Date.now(),
    `handshake with ${node.host}:${node.port}`,
  );
  return client;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p.finally(() => clearTimeout(timer)),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out: ${what}`)), Math.max(0, ms));
    }),
  ]);
}

/** Resolves with the first event matching `pred`. */
export function nextEvent<T>(
  subscribe: (cb: (e: T) => void) => () => void,
  pred: (e: T) => boolean,
  ms: number,
  what: string,
): Promise<T> {
  let off = () => {};
  return withTimeout(
    new Promise<T>((resolve) => {
      off = subscribe((e) => {
        if (pred(e)) resolve(e);
      });
    }),
    ms,
    what,
  ).finally(() => off());
}

/** One line per finding, collected into the CI job summary. */
export function report(line: string): void {
  // eslint-disable-next-line no-console
  console.log(`[mesh-sim] ${line}`);
}
