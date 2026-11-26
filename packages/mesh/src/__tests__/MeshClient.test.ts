import { create, toBinary } from '@bufbuild/protobuf';
import { Channel, Mesh, Portnums } from '../protobufs';
import {
  MeshClient,
  type AppMessageEvent,
  type MeshClientOptions,
  type TextEvent,
} from '../MeshClient';
import {
  FakeAir,
  FakeRadio,
  QUEUE_FULL_RES,
  TEST_PSK,
  type FakeRadioOptions,
} from '../transports/FakeTransport';
import { seededRandom } from '../testing/seededRandom';
import {
  BROADCAST_ADDR,
  SPECIAL_CONFIG_NONCES,
  decodeToRadio,
  encodeRouting,
} from '../codec/radio';
import {
  AppMessageType,
  CheckInMode,
  HUNTCLUB_PORT,
  encodeAppMessage,
  type AppMessage,
} from '../codec/appPort';
import type { RandomSource } from '../random';
import { encodeUtf8 } from '../runtime';
import { base64UrlEncode } from '../codec/base64url';

const ALICE = 0xa11ce001;
const BOB = 0xb0b00002;
const CAROL = 0xca401003;

const tick = (ms = 0) => jest.advanceTimersByTimeAsync(ms);

function makeClient(radio: FakeRadio, opts: Partial<MeshClientOptions> = {}, seed = radio.nodeNum) {
  return new MeshClient({ transport: radio, random: seededRandom(seed), ...opts });
}

async function connected(radioOpts: FakeRadioOptions, clientOpts: Partial<MeshClientOptions> = {}) {
  const radio = new FakeRadio(radioOpts);
  const client = makeClient(radio, clientOpts);
  await client.connect();
  await tick();
  return { radio, client };
}

function collect<T>(client: MeshClient, event: Parameters<MeshClient['on']>[0]): T[] {
  const out: T[] = [];
  client.on(event, (e) => out.push(e as T));
  return out;
}

function wantConfigNonces(radio: FakeRadio): number[] {
  return radio.writes
    .filter((w) => w.payloadVariant.case === 'wantConfigId')
    .map((w) => w.payloadVariant.value as number);
}

/** The radio records writes but never answers them (no config dump, no acks). */
function swallowWrites(radio: FakeRadio): void {
  radio.write = async (b) => {
    radio.writes.push(decodeToRadio(b));
  };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('handshake', () => {
  it('sends want_config_id with a random nonce and becomes ready on the matching config_complete', async () => {
    const radio = new FakeRadio({
      nodeNum: ALICE,
      longName: 'Alice',
      firmwareVersion: '2.7.26.54e0d8d',
    });
    const client = makeClient(radio);
    const states = collect<string>(client, 'state');
    const ready = collect<{ myNodeNum: number }>(client, 'ready');
    await client.connect();
    await tick();

    expect(states).toEqual(['connecting', 'configuring', 'ready']);
    expect(ready).toEqual([{ myNodeNum: ALICE }]);
    const [nonce] = wantConfigNonces(radio);
    expect(nonce).toBeGreaterThan(0);
    expect(SPECIAL_CONFIG_NONCES).not.toContain(nonce);

    expect(client.myNodeNum).toBe(ALICE);
    expect(client.firmwareVersion).toBe('2.7.26.54e0d8d');
    expect(client.nodes.get(ALICE)?.user?.longName).toBe('Alice');
    expect(client.channels.size).toBe(8);
    expect(client.channels.get(0)?.settings?.name).toBe('Test');
    expect(client.config.lora?.region).toBeDefined();
    expect(client.config.device).toBeDefined();
    expect(client.config.position?.rxGpio).toBe(34);
    expect(client.moduleConfig.mqtt).toBeDefined();
  });

  it('loads other nodes from the config dump', async () => {
    const air = new FakeAir();
    const alice = new FakeRadio({ nodeNum: ALICE });
    const bob = new FakeRadio({ nodeNum: BOB, longName: 'Bob' });
    air.attach(alice, bob);
    const client = makeClient(alice);
    await client.connect();
    await tick();
    expect(client.nodes.get(BOB)?.user?.longName).toBe('Bob');
  });

  it('re-runs the handshake with a fresh nonce after every reconnect', async () => {
    const { radio, client } = await connected({ nodeNum: ALICE });
    const states = collect<string>(client, 'state');
    const ready = collect(client, 'ready');

    radio.dropLink();
    expect(client.state).toBe('disconnected');
    radio.restoreLink();
    await tick();
    radio.dropLink();
    radio.restoreLink();
    await tick();

    const nonces = wantConfigNonces(radio);
    expect(nonces).toHaveLength(3);
    expect(new Set(nonces).size).toBe(3);
    expect(radio.handshakes).toBe(3);
    expect(ready).toHaveLength(2);
    expect(states).toEqual([
      'disconnected',
      'connecting',
      'configuring',
      'ready',
      'disconnected',
      'connecting',
      'configuring',
      'ready',
    ]);
    expect(client.state).toBe('ready');
  });

  it('ignores a config_complete with a stale nonce', async () => {
    const radio = new FakeRadio({ nodeNum: ALICE });
    swallowWrites(radio);
    const client = makeClient(radio);
    await client.connect();
    await tick();
    radio.injectFromRadio({ payloadVariant: { case: 'configCompleteId', value: 12345 } });
    await tick();
    expect(client.state).toBe('configuring');
    radio.injectFromRadio({
      payloadVariant: { case: 'configCompleteId', value: wantConfigNonces(radio)[0]! },
    });
    await tick();
    expect(client.state).toBe('ready');
  });

  it('retries want_config_id if the dump never completes', async () => {
    const radio = new FakeRadio({ nodeNum: ALICE });
    swallowWrites(radio);
    const client = makeClient(radio, { handshakeTimeoutMs: 1000 });
    await client.connect();
    await tick(999);
    expect(wantConfigNonces(radio)).toHaveLength(1);
    await tick(1);
    expect(wantConfigNonces(radio)).toHaveLength(2);
    await tick(1000);
    expect(wantConfigNonces(radio)).toHaveLength(3);
    radio.dropLink();
    await tick(5000);
    expect(wantConfigNonces(radio)).toHaveLength(3);
  });

  it('re-handshakes when the radio reports it rebooted', async () => {
    const { radio, client } = await connected({ nodeNum: ALICE });
    const rebooted = collect(client, 'rebooted');
    radio.injectFromRadio({ payloadVariant: { case: 'rebooted', value: true } });
    await tick();
    expect(rebooted).toHaveLength(1);
    expect(wantConfigNonces(radio)).toHaveLength(2);
    expect(client.state).toBe('ready');
  });

  it('never chooses a special nonce', async () => {
    // 69420 = 0x00010f2c, then 69421, then a normal value.
    const seq = [
      Uint8Array.of(0, 1, 0x0f, 0x2c),
      Uint8Array.of(0, 1, 0x0f, 0x2d),
      Uint8Array.of(0, 0, 0, 7),
    ];
    const random: RandomSource = (n) =>
      n === 4 && seq.length ? seq.shift()! : new Uint8Array(n).fill(1);
    const radio = new FakeRadio({ nodeNum: ALICE });
    const client = new MeshClient({ transport: radio, random });
    await client.connect();
    expect(wantConfigNonces(radio)).toEqual([7]);
  });

  it('parses unknown and malformed FromRadio frames leniently', async () => {
    const { radio, client } = await connected({ nodeNum: ALICE });
    const texts = collect<TextEvent>(client, 'text');
    radio.injectRaw(Uint8Array.of(0x9a, 0x06, 0x02, 0x01, 0x02)); // unknown variant from newer firmware
    radio.injectRaw(Uint8Array.of(0xff, 0xff, 0xff)); // garbage
    radio.injectRaw(new Uint8Array(0)); // empty read
    radio.injectFromRadio({ payloadVariant: { case: 'logRecord', value: { message: 'x' } } });
    radio.injectFromRadio({ payloadVariant: { case: 'fileInfo', value: { fileName: '/prefs' } } });
    radio.injectPacket({
      from: BOB,
      id: 1,
      payloadVariant: { case: 'encrypted', value: Uint8Array.of(1, 2, 3) },
    });
    radio.injectPacket({
      from: BOB,
      id: 2,
      payloadVariant: {
        case: 'decoded',
        value: { portnum: Portnums.PortNum.POSITION_APP, payload: Uint8Array.of(0xff) },
      },
    });
    radio.injectPacket({
      from: BOB,
      id: 3,
      payloadVariant: {
        case: 'decoded',
        value: { portnum: Portnums.PortNum.TEXT_MESSAGE_APP, payload: encodeUtf8('still works') },
      },
    });
    await tick();
    expect(client.state).toBe('ready');
    expect(texts.map((t) => t.text)).toEqual(['still works']);
  });

  it('forgets the node DB when a different radio connects', async () => {
    const { radio, client } = await connected({ nodeNum: ALICE });
    radio.injectFromRadio({ payloadVariant: { case: 'nodeInfo', value: { num: CAROL } } });
    await tick();
    expect(client.nodes.has(CAROL)).toBe(true);
    radio.injectFromRadio({ payloadVariant: { case: 'myInfo', value: { myNodeNum: BOB } } });
    await tick();
    expect(client.nodes.has(CAROL)).toBe(false);
    expect(client.myNodeNum).toBe(BOB);
  });
});

describe('two radios over the air', () => {
  async function pair(airOpts: ConstructorParameters<typeof FakeAir>[0] = {}) {
    const air = new FakeAir(airOpts);
    const aliceRadio = new FakeRadio({ nodeNum: ALICE, longName: 'Alice' });
    const bobRadio = new FakeRadio({ nodeNum: BOB, longName: 'Bob' });
    air.attach(aliceRadio, bobRadio);
    const alice = makeClient(aliceRadio);
    const bob = makeClient(bobRadio);
    await alice.connect();
    await bob.connect();
    await tick();
    return { air, aliceRadio, bobRadio, alice, bob };
  }

  it('texts both ways on the primary channel', async () => {
    const { alice, bob } = await pair();
    const atBob = collect<TextEvent>(bob, 'text');
    const atAlice = collect<TextEvent>(alice, 'text');

    const h1 = alice.sendText('Buck moving toward the creek');
    await tick(500);
    const h2 = bob.sendText('Copy, watching it');
    await tick(500);

    expect(atBob).toEqual([
      expect.objectContaining({
        from: ALICE,
        to: BROADCAST_ADDR,
        channel: 0,
        text: 'Buck moving toward the creek',
        isDirect: false,
        packetId: h1.id,
      }),
    ]);
    expect(atAlice).toEqual([
      expect.objectContaining({ from: BOB, text: 'Copy, watching it', packetId: h2.id }),
    ]);
    await expect(h1.result).resolves.toEqual({ status: 'acked', by: ALICE, implicit: true });
    await expect(h2.result).resolves.toEqual({ status: 'acked', by: BOB, implicit: true });
    expect(bob.nodes.get(ALICE)?.lastHeard).toBeGreaterThan(0);
  });

  it('sends a direct text and gets a real ack from the destination', async () => {
    const { alice, bob } = await pair();
    const atBob = collect<TextEvent>(bob, 'text');
    const acks = collect(alice, 'ack');
    const h = alice.sendText('Need a hand dragging', { to: BOB });
    await tick(300);
    expect(atBob[0]).toMatchObject({ isDirect: true, to: BOB });
    await expect(h.result).resolves.toEqual({ status: 'acked', by: BOB, implicit: false });
    expect(acks).toEqual([{ packetId: h.id, by: BOB, implicit: false }]);
  });

  it('drops duplicate rebroadcasts of the same packet', async () => {
    const { air, alice, bob } = await pair({ duplicates: 3 });
    const atBob = collect<TextEvent>(bob, 'text');
    alice.sendText('one');
    await tick(300);
    expect(atBob).toHaveLength(1);

    // A late relay copy, minutes later.
    await tick(5 * 60_000);
    air.rebroadcast(air.log.length - 1, 2);
    await tick();
    expect(atBob).toHaveLength(1);

    // A new packet with the same text is not a duplicate.
    alice.sendText('one');
    await tick(300);
    expect(atBob).toHaveLength(2);
  });

  it('does not replay packets after a reconnect', async () => {
    const { bobRadio, alice, bob } = await pair();
    const atBob = collect<TextEvent>(bob, 'text');
    const h = alice.sendText('before drop');
    await tick(300);
    bobRadio.dropLink();
    bobRadio.restoreLink();
    // Radio replays a cached copy of the same packet after the new config dump.
    bobRadio.injectPacket({
      from: ALICE,
      to: BROADCAST_ADDR,
      id: h.id,
      payloadVariant: {
        case: 'decoded',
        value: { portnum: Portnums.PortNum.TEXT_MESSAGE_APP, payload: encodeUtf8('before drop') },
      },
    });
    await tick();
    expect(bob.state).toBe('ready');
    expect(atBob).toHaveLength(1);
  });

  it('delivers packets heard while the phone was away after the next handshake', async () => {
    const { bobRadio, alice, bob } = await pair();
    const atBob = collect<TextEvent>(bob, 'text');
    bobRadio.dropLink();
    alice.sendText('while you were out');
    await tick(300);
    expect(atBob).toHaveLength(0);
    bobRadio.restoreLink();
    await tick();
    expect(atBob.map((t) => t.text)).toEqual(['while you were out']);
  });

  it('only radios on the same channel (name + key) hear each other', async () => {
    const air = new FakeAir();
    const a = new FakeRadio({ nodeNum: ALICE });
    const otherKey = TEST_PSK.map((b) => b ^ 0xff);
    const c = new FakeRadio({
      nodeNum: CAROL,
      channels: [create(Channel.ChannelSettingsSchema, { name: 'Test', psk: otherKey })],
    });
    air.attach(a, c);
    const alice = makeClient(a);
    const carol = makeClient(c);
    await alice.connect();
    await carol.connect();
    await tick();
    const atCarol = collect<TextEvent>(carol, 'text');
    const h = alice.sendText('private');
    await tick(300);
    expect(atCarol).toHaveLength(0);
    // No one could relay it: the radio reports a failure.
    await expect(h.result).resolves.toMatchObject({
      status: 'failed',
      code: Mesh.Routing_Error.MAX_RETRANSMIT,
      reason: 'MAX_RETRANSMIT',
    });
  });

  it('carries app-port messages and de-duplicates them by message id', async () => {
    const { alice, bob } = await pair({ duplicates: 1 });
    const atBob = collect<AppMessageEvent>(bob, 'appMessage');
    const repeats = collect<AppMessageEvent>(bob, 'appMessageRepeat');
    const help: AppMessage = {
      type: AppMessageType.HelpRequest,
      id: 0xbeef,
      sender: ALICE,
      time: 1_764_150_000,
      mode: CheckInMode.Spot,
      pin: { lat: 44.5, lon: -93.25 },
    };
    const first = alice.sendAppMessage(help);
    await tick(300);
    // Ask for a Hand retry: same message id, new packet id.
    const retry = alice.sendAppMessage(help);
    await tick(300);

    expect(first.id).not.toBe(retry.id);
    expect(atBob).toHaveLength(1);
    expect(atBob[0]!.message).toEqual(help);
    expect(atBob[0]!.from).toBe(ALICE);
    expect(repeats).toHaveLength(1);
    expect(repeats[0]!.packetId).toBe(retry.id);
  });

  it('sends a Receipt back and the sender sees it', async () => {
    const { alice, bob } = await pair();
    const receipts = collect<AppMessageEvent>(alice, 'appMessage');
    bob.on('appMessage', ({ message }) => {
      if (message.type !== AppMessageType.Receipt) {
        bob.sendAppMessage(
          { type: AppMessageType.Receipt, id: 77, sender: bob.myNodeNum, ackedId: message.id },
          { wantAck: false },
        );
      }
    });
    alice.sendAppMessage({
      type: AppMessageType.CheckIn,
      id: 555,
      sender: ALICE,
      mode: CheckInMode.Moving,
    });
    await tick(1000);
    expect(receipts.map((r) => r.message)).toEqual([
      { type: AppMessageType.Receipt, id: 77, sender: BOB, ackedId: 555 },
    ]);
  });

  it('does not report our own app message back to us', async () => {
    const { alice } = await pair();
    const own = collect<AppMessageEvent>(alice, 'appMessage');
    const msg: AppMessage = { type: AppMessageType.CheckOut, id: 9, sender: ALICE };
    alice.sendAppMessage(msg);
    await tick(300);
    // A relay echoes it back to Alice's radio.
    const radio = (alice as unknown as { transport: FakeRadio }).transport;
    radio.injectPacket({
      from: ALICE,
      id: 4242,
      payloadVariant: {
        case: 'decoded',
        value: { portnum: HUNTCLUB_PORT as Portnums.PortNum, payload: encodeAppMessage(msg) },
      },
    });
    await tick();
    expect(own).toHaveLength(0);
  });

  it('emits positions and updates the node DB', async () => {
    const { bobRadio, bob } = await pair();
    const positions = collect<{ from: number; lat?: number; lon?: number }>(bob, 'position');
    bobRadio.injectPacket({
      from: ALICE,
      id: 31,
      hopStart: 3,
      hopLimit: 2,
      payloadVariant: {
        case: 'decoded',
        value: {
          portnum: Portnums.PortNum.POSITION_APP,
          payload: toBinary(
            Mesh.PositionSchema,
            create(Mesh.PositionSchema, { latitudeI: 445000000, longitudeI: -932500000, time: 1 }),
          ),
        },
      },
    });
    await tick();
    expect(positions).toEqual([expect.objectContaining({ from: ALICE, lat: 44.5, lon: -93.25 })]);
    expect(bob.nodes.get(ALICE)?.position?.latitudeI).toBe(445000000);
    expect(bob.nodes.get(ALICE)?.hopsAway).toBe(1);
  });

  it('updates node info from NODEINFO_APP packets', async () => {
    const { bobRadio, bob } = await pair();
    const infos = collect<{ node: { num: number } }>(bob, 'nodeinfo');
    bobRadio.injectPacket({
      from: CAROL,
      id: 32,
      payloadVariant: {
        case: 'decoded',
        value: {
          portnum: Portnums.PortNum.NODEINFO_APP,
          payload: toBinary(
            Mesh.UserSchema,
            create(Mesh.UserSchema, { longName: 'Carol', shortName: 'CR' }),
          ),
        },
      },
    });
    await tick();
    expect(bob.nodes.get(CAROL)?.user?.longName).toBe('Carol');
    expect(infos.at(-1)?.node.num).toBe(CAROL);
  });
});

describe('acks and the send queue', () => {
  it('matches acks and naks by request_id, including unknown ids', async () => {
    const { radio, client } = await connected({ nodeNum: ALICE, ackMode: 'none' });
    const acks = collect(client, 'ack');
    const naks = collect(client, 'nak');
    const a = client.sendText('a');
    const b = client.sendText('b');
    await tick(500);
    const routing = (
      requestId: number,
      err: Mesh.Routing_Error,
      from = ALICE,
      id = requestId + 1,
    ) =>
      radio.injectPacket({
        from,
        id,
        to: ALICE,
        payloadVariant: {
          case: 'decoded',
          value: { portnum: Portnums.PortNum.ROUTING_APP, payload: encodeRouting(err), requestId },
        },
      });
    routing(b.id, Mesh.Routing_Error.NONE, BOB);
    routing(a.id, Mesh.Routing_Error.DUTY_CYCLE_LIMIT);
    routing(0x5555, Mesh.Routing_Error.NONE);
    await tick();
    await expect(a.result).resolves.toEqual({
      status: 'failed',
      code: Mesh.Routing_Error.DUTY_CYCLE_LIMIT,
      reason: 'DUTY_CYCLE_LIMIT',
    });
    await expect(b.result).resolves.toEqual({ status: 'acked', by: BOB, implicit: false });
    expect(acks).toEqual([
      { packetId: b.id, by: BOB, implicit: false },
      { packetId: 0x5555, by: ALICE, implicit: true },
    ]);
    expect(naks).toEqual([
      { packetId: a.id, code: Mesh.Routing_Error.DUTY_CYCLE_LIMIT, reason: 'DUTY_CYCLE_LIMIT' },
    ]);
  });

  it('a second ack for the same packet is harmless', async () => {
    const { radio, client } = await connected({ nodeNum: ALICE });
    const h = client.sendText('x');
    await tick(300);
    await expect(h.result).resolves.toMatchObject({ status: 'acked' });
    radio.injectPacket({
      from: BOB,
      id: 999,
      payloadVariant: {
        case: 'decoded',
        value: {
          portnum: Portnums.PortNum.ROUTING_APP,
          payload: encodeRouting(Mesh.Routing_Error.NONE),
          requestId: h.id,
        },
      },
    });
    await tick();
    await expect(h.result).resolves.toMatchObject({ status: 'acked', by: ALICE });
  });

  it('times out when no ack arrives', async () => {
    const { client } = await connected(
      { nodeNum: ALICE, ackMode: 'none' },
      { ackTimeoutMs: 10_000 },
    );
    const h = client.sendText('anyone?');
    let settled = false;
    void h.result.then(() => (settled = true));
    await tick(9_000);
    expect(settled).toBe(false);
    await tick(2_000);
    await expect(h.result).resolves.toEqual({ status: 'timeout' });
  });

  it('resolves as sent when no ack was requested', async () => {
    const { client } = await connected({ nodeNum: ALICE });
    const h = client.sendText('fyi', { wantAck: false });
    await tick(10);
    await expect(h.result).resolves.toEqual({ status: 'sent' });
  });

  it('assumes accepted if the radio sends no QueueStatus (older firmware)', async () => {
    const { client } = await connected(
      { nodeNum: ALICE, sendQueueStatus: false },
      { queueStatusTimeoutMs: 1000 },
    );
    const h = client.sendText('x', { wantAck: false });
    let done = false;
    void h.result.then(() => (done = true));
    await tick(900);
    expect(done).toBe(false);
    await tick(200);
    await expect(h.result).resolves.toEqual({ status: 'sent' });
  });

  it('paces writes about 200 ms apart', async () => {
    const { radio, client } = await connected({ nodeNum: ALICE });
    const writeTimes: number[] = [];
    const orig = radio.write.bind(radio);
    radio.write = (b) => {
      writeTimes.push(Date.now());
      return orig(b);
    };
    for (let i = 0; i < 5; i++) client.sendText(`m${i}`);
    await tick(2000);
    expect(writeTimes).toHaveLength(5);
    for (let i = 1; i < writeTimes.length; i++)
      expect(writeTimes[i]! - writeTimes[i - 1]!).toBeGreaterThanOrEqual(200);
  });

  it('respects the radio TX queue reported by QueueStatus', async () => {
    const { radio, client } = await connected(
      { nodeNum: ALICE, queueSize: 2, drainTxQueue: false, ackMode: 'none' },
      { pacingMs: 0 },
    );
    const statuses = collect<{ free: number }>(client, 'queueStatus');
    const handles = Array.from({ length: 5 }, (_, i) =>
      client.sendText(`m${i}`, { wantAck: false }),
    );
    await tick(1000);
    const packetsWritten = () =>
      radio.writes.filter((w) => w.payloadVariant.case === 'packet').length;
    expect(packetsWritten()).toBe(2);
    expect(client.pendingCount).toBe(3);
    expect(statuses.at(-1)?.free).toBe(0);

    radio.drainQueue();
    await tick(1000);
    expect(packetsWritten()).toBe(4);
    radio.drainQueue();
    await tick(1000);
    expect(packetsWritten()).toBe(5);
    const results = await Promise.all(handles.map((h) => h.result));
    expect(results.every((r) => r.status === 'sent')).toBe(true);
  });

  it('probes again if the radio reports a full queue and then goes quiet', async () => {
    const { radio, client } = await connected(
      { nodeNum: ALICE, queueSize: 1, drainTxQueue: false, ackMode: 'none' },
      { pacingMs: 0, queueFullProbeMs: 10_000 },
    );
    const packetsWritten = () =>
      radio.writes.filter((w) => w.payloadVariant.case === 'packet').length;
    client.sendText('a', { wantAck: false });
    const b = client.sendText('b', { wantAck: false });
    await tick(5_000);
    expect(packetsWritten()).toBe(1);
    // The radio drained silently (no QueueStatus).
    (radio as unknown as { txInFlight: number }).txInFlight = 0;
    await tick(5_000);
    expect(packetsWritten()).toBe(2);
    await expect(b.result).resolves.toEqual({ status: 'sent' });
  });

  it('fails a packet the radio rejects in QueueStatus', async () => {
    const { client } = await connected({ nodeNum: ALICE, queueStatusRes: QUEUE_FULL_RES });
    const naks = collect(client, 'nak');
    const h = client.sendText('x');
    await tick(10);
    await expect(h.result).resolves.toEqual({
      status: 'failed',
      code: QUEUE_FULL_RES,
      reason: `QUEUE_${QUEUE_FULL_RES}`,
    });
    expect(naks).toHaveLength(1);
  });

  it('holds sends while disconnected and sends them after the next handshake', async () => {
    const radio = new FakeRadio({ nodeNum: ALICE });
    const client = makeClient(radio);
    const h = client.sendText('queued offline');
    await tick(1000);
    expect(radio.writes).toHaveLength(0);
    await client.connect();
    await tick(500);
    const kinds = radio.writes.map((w) => w.payloadVariant.case);
    expect(kinds).toEqual(['wantConfigId', 'packet']);
    await expect(h.result).resolves.toMatchObject({ status: 'acked' });
  });

  it('re-queues a packet whose write failed and sends it after reconnect', async () => {
    const { radio, client } = await connected({ nodeNum: ALICE });
    const orig = radio.write.bind(radio);
    let fail = true;
    radio.write = async (b) => {
      if (fail) {
        fail = false;
        radio.dropLink();
        throw new Error('link lost');
      }
      return orig(b);
    };
    const h = client.sendText('retry me');
    await tick(10);
    expect(client.pendingCount).toBe(1);
    radio.restoreLink();
    await tick(500);
    expect(client.pendingCount).toBe(0);
    await expect(h.result).resolves.toMatchObject({ status: 'acked' });
  });

  it('keeps waiting for an ack across a link drop', async () => {
    const { radio, client } = await connected({ nodeNum: ALICE, ackMode: 'none' });
    const h = client.sendText('x');
    await tick(300);
    radio.dropLink();
    radio.restoreLink();
    await tick(300);
    radio.injectPacket({
      from: ALICE,
      id: 1234,
      payloadVariant: {
        case: 'decoded',
        value: {
          portnum: Portnums.PortNum.ROUTING_APP,
          payload: encodeRouting(Mesh.Routing_Error.NONE),
          requestId: h.id,
        },
      },
    });
    await tick();
    await expect(h.result).resolves.toMatchObject({ status: 'acked' });
  });

  it('close() sends disconnect and cancels pending sends', async () => {
    const { radio, client } = await connected({ nodeNum: ALICE, ackMode: 'none' });
    const inFlight = client.sendText('in flight');
    await tick(300);
    const queued = client.sendText('queued');
    await client.close();
    await expect(inFlight.result).resolves.toEqual({ status: 'cancelled' });
    await expect(queued.result).resolves.toEqual({ status: 'cancelled' });
    expect(radio.writes.at(-1)?.payloadVariant.case).toBe('disconnect');
    expect(client.state).toBe('disconnected');
  });

  it('uses unique random packet ids and honours channel / hop options', async () => {
    const { radio, client } = await connected({ nodeNum: ALICE });
    const ids = new Set<number>();
    for (let i = 0; i < 20; i++)
      ids.add(client.sendText('x', { wantAck: false, channel: 0, hopLimit: 2 }).id);
    await tick(10_000);
    expect(ids.size).toBe(20);
    const p = radio.writes.find((w) => w.payloadVariant.case === 'packet')!.payloadVariant
      .value as Mesh.MeshPacket;
    expect(p.hopLimit).toBe(2);
  });

  it('sends a heartbeat outside the queue', async () => {
    const { radio, client } = await connected({ nodeNum: ALICE });
    await client.heartbeat();
    expect(radio.writes.at(-1)?.payloadVariant.case).toBe('heartbeat');
  });
});

describe('logging', () => {
  it('never logs message bodies or channel keys', async () => {
    const lines: string[] = [];
    const air = new FakeAir();
    const aliceRadio = new FakeRadio({ nodeNum: ALICE });
    const bobRadio = new FakeRadio({ nodeNum: BOB });
    air.attach(aliceRadio, bobRadio);
    const log = (event: string, details?: object) =>
      lines.push(event + JSON.stringify(details ?? {}));
    const alice = makeClient(aliceRadio, { log });
    const bob = makeClient(bobRadio, { log });
    await alice.connect();
    await bob.connect();
    await tick();
    alice.sendText('SECRET-TEXT-BODY');
    alice.sendAppMessage({
      type: AppMessageType.HelpRequest,
      id: 5,
      sender: ALICE,
      note: 'SECRET-NOTE',
    });
    await tick(1000);
    const all = lines.join('\n');
    expect(lines.length).toBeGreaterThan(5);
    expect(all).not.toContain('SECRET');
    const keyHex = [...TEST_PSK].map((b) => b.toString(16).padStart(2, '0')).join('');
    expect(all).not.toContain(keyHex);
    expect(all).not.toContain(base64UrlEncode(TEST_PSK).slice(0, 20));
  });
});
