import { MeshClient } from '../MeshClient';
import { StreamTransport } from '../transports/StreamTransport';
import { FakeAir, FakeRadio } from '../transports/FakeTransport';
import { framedFakeRadio } from '../testing/framedRadio';
import { NODES, collect, createClient, tick } from '../testing/fixtures';
import { seededRandom } from '../testing/seededRandom';
import { encodeUtf8 } from '../runtime';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

/** Alice's phone talks to her radio over a framed stream; Bob uses the plain fake. */
async function setup(opts: ConstructorParameters<typeof StreamTransport>[1] = {}) {
  const air = new FakeAir();
  const aliceRadio = new FakeRadio({ nodeNum: NODES.alice });
  const bobRadio = new FakeRadio({ nodeNum: NODES.bob });
  air.attach(aliceRadio, bobRadio);
  const link = framedFakeRadio(aliceRadio);
  const transport = new StreamTransport(link.open, opts);
  const alice = new MeshClient({ transport, random: seededRandom(1) });
  const bob = createClient(bobRadio);
  await bob.connect();
  await alice.connect();
  await tick();
  return { link, transport, alice, bob, aliceRadio };
}

describe('StreamTransport', () => {
  it('handshakes and texts both ways over a framed stream', async () => {
    const { alice, bob, aliceRadio } = await setup();
    expect(alice.state).toBe('ready');
    expect(alice.myNodeNum).toBe(NODES.alice);
    // The wake sequence is not a ToRadio and is ignored by the radio.
    expect(aliceRadio.writes[0]!.payloadVariant.case).toBe('wantConfigId');
    const atAlice = collect(alice, 'text');
    const atBob = collect(bob, 'text');
    alice.sendText('over tcp');
    bob.sendText('back at you');
    await tick(1000);
    expect(atBob.map((t) => t.text)).toEqual(['over tcp']);
    expect(atAlice.map((t) => t.text)).toEqual(['back at you']);
  });

  it('ignores debug text between frames', async () => {
    const { link, alice, bob } = await setup();
    const atAlice = collect(alice, 'text');
    link.inject(encodeUtf8('DEBUG | some log line\n'));
    bob.sendText('still fine');
    await tick(1000);
    expect(atAlice.map((t) => t.text)).toEqual(['still fine']);
  });

  it('reconnects with backoff after the device drops the stream, and re-handshakes', async () => {
    const { link, alice, aliceRadio } = await setup({
      reconnect: { initialMs: 1000, maxMs: 4000 },
    });
    const states = collect(alice, 'state');
    link.failNextOpen();
    link.kill();
    expect(alice.state).toBe('disconnected');
    await tick(1000); // first retry fails
    expect(alice.state).toBe('disconnected');
    await tick(2000); // second retry (2 s later) works
    expect(alice.state).toBe('ready');
    expect(aliceRadio.handshakes).toBe(2);
    expect(states).toEqual([
      'disconnected',
      'connecting',
      'disconnected',
      'connecting',
      'configuring',
      'ready',
    ]);
  });

  it('disconnect() closes the stream and stops reconnecting', async () => {
    const { transport, alice } = await setup();
    await transport.disconnect();
    expect(transport.connected).toBe(false);
    expect(alice.state).toBe('disconnected');
    await tick(60_000);
    expect(alice.state).toBe('disconnected');
    await expect(transport.write(Uint8Array.of(1))).rejects.toThrow('not connected');
  });

  it('a failed first connect throws; without reconnect nothing retries', async () => {
    const radio = new FakeRadio({ nodeNum: NODES.alice });
    const link = framedFakeRadio(radio);
    link.failNextOpen();
    const t = new StreamTransport(link.open, { reconnect: false, wake: false });
    const statuses: string[] = [];
    t.onStatus((s) => statuses.push(s));
    await expect(t.connect()).rejects.toThrow('connection refused');
    await tick(60_000);
    expect(statuses).toEqual(['connecting', 'disconnected']);
    await t.connect();
    expect(t.connected).toBe(true);
  });
});
