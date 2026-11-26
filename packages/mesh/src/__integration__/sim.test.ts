/**
 * Integration tests against stock Meshtastic firmware running as
 * `meshtasticd --sim` (CI workflow "mesh-sim"). Each test reports what it
 * saw with report(), so the job log shows what works on real firmware even
 * while the job is non-blocking.
 */
import { clone, create } from '@bufbuild/protobuf';
import type { MeshClient } from '../MeshClient';
import { AppMessageType, CheckInMode, type AppMessage } from '../codec/appPort';
import { generatePartyChannelSet } from '../codec/channelUrl';
import { planFromChannelSet } from '../provisioning';
import { Config } from '../protobufs';
import { seededRandom } from '../testing/seededRandom';
import {
  SIM_ENABLED,
  SIM_IS_FAKE,
  clientLogs,
  connectClient,
  nextEvent,
  report,
  simNodes,
  sleep,
  stopSim,
  withTimeout,
  type SimNode,
} from './sim';

const suite = SIM_ENABLED ? describe : describe.skip;

suite('meshtasticd --sim', () => {
  let nodes: SimNode[] = [];
  let clients: MeshClient[] = [];
  const party = generatePartyChannelSet({ random: seededRandom(0x5eed) });
  const a = () => clients[0]!;
  const b = () => clients[1]!;
  const twoNodes = () => clients.length >= 2;

  async function connectAll() {
    await Promise.all(clients.map((c) => c.close().catch(() => {})));
    clients = await Promise.all(nodes.map((n) => connectClient(n)));
  }

  beforeAll(async () => {
    nodes = await simNodes();
    expect(nodes.length).toBeGreaterThanOrEqual(1);
    report(
      `nodes: ${nodes.map((n) => `${n.host}:${n.port}`).join(', ')}${SIM_IS_FAKE ? ' (fake)' : ''}`,
    );
    await connectAll();
  });

  afterAll(async () => {
    // Client-side view of every send (ids, ports, queue status, states), for diagnosing CI runs.
    for (const [node, lines] of clientLogs) {
      report(
        `client log ${node} (last ${Math.min(lines.length, 80)} lines):\n  ${lines.slice(-80).join('\n  ')}`,
      );
    }
    await Promise.all(clients.map((c) => c.close().catch(() => {})));
    await stopSim();
  });

  it('handshake: config dump with my_info, node info, channels and firmware version', () => {
    for (const c of clients) {
      expect(c.state).toBe('ready');
      expect(c.myNodeNum).toBeGreaterThan(0);
      expect(c.channels.size).toBeGreaterThan(0);
      expect(c.nodes.get(c.myNodeNum)?.user).toBeDefined();
      report(
        `handshake ok: node !${c.myNodeNum.toString(16)} firmware ${c.firmwareVersion ?? '?'}, ` +
          `${c.channels.size} channels, config sections: ${Object.keys(c.config).join(',')}`,
      );
    }
  });

  it('re-handshake on a new connection', async () => {
    const first = a().myNodeNum;
    await connectAll();
    expect(a().myNodeNum).toBe(first);
    report('re-handshake on reconnect ok');
  });

  it('provisioning: party channel (and UDP mesh for the simulator) accepted and kept', async () => {
    for (const c of clients) {
      const handles = c.provision(planFromChannelSet(party));
      if (!SIM_IS_FAKE) {
        // Let simulated nodes on one host mesh over UDP multicast (firmware 2.6+).
        const network = c.config.network
          ? clone(Config.Config_NetworkConfigSchema, c.config.network)
          : create(Config.Config_NetworkConfigSchema);
        network.enabledProtocols = Config.Config_NetworkConfig_ProtocolFlags.UDP_BROADCAST;
        handles.push(c.sendAdmin({ payloadVariant: { case: 'beginEditSettings', value: true } }));
        handles.push(
          c.sendAdmin({
            payloadVariant: {
              case: 'setConfig',
              value: {
                payloadVariant: {
                  case: 'network',
                  value: network,
                },
              },
            },
          }),
        );
        handles.push(c.sendAdmin({ payloadVariant: { case: 'commitEditSettings', value: true } }));
      }
      const results = await withTimeout(
        Promise.all(handles.map((h) => h.result)),
        150_000,
        'provisioning results',
      );
      const counts = results.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
      }, {});
      report(`provisioning !${c.myNodeNum.toString(16)}: ${JSON.stringify(counts)}`);
      expect(results.filter((r) => r.status === 'failed')).toEqual([]);
    }

    // The radio may restart to apply the settings: reconnect and read them back.
    await sleep(SIM_IS_FAKE ? 100 : 5_000);
    await connectAll();
    for (const c of clients) {
      const ch = c.channels.get(0)?.settings;
      expect(ch?.psk).toEqual(party.settings[0]!.psk);
      expect(ch?.moduleSettings?.positionPrecision).toBe(32);
      expect(c.config.device?.rebroadcastMode).toBe(Config.Config_DeviceConfig_RebroadcastMode.ALL);
      report(
        `after provisioning !${c.myNodeNum.toString(16)}: party channel active, region ${
          Config.Config_LoRaConfig_RegionCode[c.config.lora?.region ?? 0]
        }, UDP ${c.config.network?.enabledProtocols ?? 0}`,
      );
    }
  });

  it('app-port message: a CheckIn is accepted by the radio and settles', async () => {
    const msg: AppMessage = {
      type: AppMessageType.CheckIn,
      id: 0x1234_5678,
      sender: a().myNodeNum,
      time: Math.floor(Date.now() / 1000),
      mode: CheckInMode.Spot,
      pin: { lat: 46.0001, lon: -94.0001 },
    };
    const result = await withTimeout(a().sendAppMessage(msg).result, 150_000, 'CheckIn result');
    report(`CheckIn send result: ${JSON.stringify(result)}`);
    expect(['acked', 'failed', 'sent']).toContain(result.status);
  });

  describe('two nodes', () => {
    const maybe = (name: string, fn: () => Promise<void>) =>
      it(name, async () => {
        if (!twoNodes()) {
          report(`skipped (one node): ${name}`);
          return;
        }
        await fn();
      });

    maybe('text both ways', async () => {
      const toB = nextEvent<{ text: string; from: number }>(
        (cb) => b().on('text', cb),
        (t) => t.text === 'ping from A',
        90_000,
        'text A→B',
      );
      a().sendText('ping from A');
      const got = await toB;
      expect(got.from).toBe(a().myNodeNum);
      const toA = nextEvent<{ text: string }>(
        (cb) => a().on('text', cb),
        (t) => t.text === 'pong from B',
        90_000,
        'text B→A',
      );
      b().sendText('pong from B');
      await toA;
      report('text both ways ok');
    });

    maybe('CheckIn + Receipt on the app port', async () => {
      const checkInId = 0x0c0ffee0;
      const off = b().on('appMessage', ({ message }) => {
        if (message.type === AppMessageType.CheckIn) {
          b().sendAppMessage(
            {
              type: AppMessageType.Receipt,
              id: 0x0dec0de0,
              sender: b().myNodeNum,
              ackedId: message.id,
            },
            { wantAck: false },
          );
        }
      });
      const receipt = nextEvent<{ message: AppMessage }>(
        (cb) => a().on('appMessage', cb),
        (e) => e.message.type === AppMessageType.Receipt,
        90_000,
        'Receipt at A',
      );
      a().sendAppMessage({
        type: AppMessageType.CheckIn,
        id: checkInId,
        sender: a().myNodeNum,
        mode: CheckInMode.Moving,
      });
      const r = await receipt;
      off();
      expect(r.message).toMatchObject({
        type: AppMessageType.Receipt,
        ackedId: checkInId,
        sender: b().myNodeNum,
      });
      report('CheckIn + Receipt ok');
    });

    maybe(
      'de-duplication: one event per message, and a retried app message is a repeat',
      async () => {
        const settle = SIM_IS_FAKE ? 1_000 : 20_000;
        const texts: string[] = [];
        const apps: number[] = [];
        const repeats: number[] = [];
        const heard: string[] = [];
        const offs = [
          b().on('text', (t) => texts.push(t.text)),
          b().on('appMessage', ({ message }) => apps.push(message.id)),
          b().on('appMessageRepeat', ({ message }) => repeats.push(message.id)),
          b().on('heard', (h) => heard.push(`${h.portnum}:${h.packetId.toString(16)}`)),
        ];
        try {
          // A text: wait for it, then make sure no second copy follows.
          const arrived = nextEvent<{ text: string }>(
            (cb) => b().on('text', cb),
            (t) => t.text === 'only once',
            90_000,
            'dedup text at B',
          );
          const textSend = a().sendText('only once');
          await arrived;
          await sleep(settle);
          report(
            `dedup text: send result ${JSON.stringify(await textSend.result)}, copies seen ${texts.length}`,
          );
          expect(texts.filter((t) => t === 'only once')).toHaveLength(1);

          // The same app message id twice under two packets (a sender retry).
          const id = 0x0fed0001;
          const first = nextEvent<{ message: AppMessage }>(
            (cb) => b().on('appMessage', cb),
            (e) => e.message.id === id,
            90_000,
            'dedup app message at B',
          );
          a().sendAppMessage(
            { type: AppMessageType.CheckOut, id, sender: a().myNodeNum },
            { wantAck: false },
          );
          await first;
          const again = nextEvent<{ message: AppMessage }>(
            (cb) => b().on('appMessageRepeat', cb),
            (e) => e.message.id === id,
            90_000,
            'retried app message at B',
          );
          a().sendAppMessage(
            { type: AppMessageType.CheckOut, id, sender: a().myNodeNum },
            { wantAck: false },
          );
          await again;
          await sleep(settle);
          expect(apps.filter((x) => x === id)).toHaveLength(1);
          expect(repeats.filter((x) => x === id)).toHaveLength(1);
          report('de-duplication ok (text once; app message once plus one repeat)');
        } finally {
          offs.forEach((off) => off());
          report(`dedup: B heard ${heard.length} packets: ${heard.join(' ')}`);
          for (const [i, c] of clients.entries()) {
            report(`client ${i}: state ${c.state}, ${c.pendingCount} queued`);
          }
        }
      },
    );
  });
});
