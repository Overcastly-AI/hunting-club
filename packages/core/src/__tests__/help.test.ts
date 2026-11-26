import { AppMessageType, CheckInMode, Protobufs, type MeshClient } from '@huntclub/mesh';
import { collect, tick } from '@huntclub/mesh/testing';
import { HelpRequester, helpRetryDelay } from '../help';
import { CORE_CONFIG } from '../config';
import { HOME, HOUR, MIN, T0, onAir, party, type Phone } from '../testing/party';

beforeEach(() => jest.useFakeTimers({ now: T0 }));
afterEach(() => jest.useRealTimers());

const HERE = { lat: 46.0123, lon: -94.0456 };

function requester(p: Phone, getLocation = () => HERE as typeof HERE | undefined) {
  return new HelpRequester(p.ctx, { getLocation, checkIns: p.checkIns });
}

describe('retry schedule', () => {
  it('doubles from 20 s up to a 5 min cap', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((a) => helpRetryDelay(a) / 1000)).toEqual([
      20, 40, 80, 160, 300, 300, 300,
    ]);
    expect(helpRetryDelay(0)).toBe(CORE_CONFIG.help.initialMs);
  });
});

describe('Ask for a Hand', () => {
  it('retries with the same message id until a receipt arrives, then stops', async () => {
    const { phones, air } = await party({ size: 2 });
    const [alice, bob] = phones;
    // Bob's phone isn't answering yet (app closed, say).
    bob!.receipts.stop();
    const help = requester(alice!);
    const states = collect(help, 'change');
    const first = help.ask();

    await tick(3 * MIN);
    const sentSoFar = onAir(air, AppMessageType.HelpRequest);
    expect(sentSoFar.length).toBeGreaterThanOrEqual(3);
    expect(new Set(sentSoFar.map((m) => m.id))).toEqual(new Set([first.id]));
    // Each copy is a new Meshtastic packet.
    const packetIds = air.log.filter((p) => Number(p.data.portnum) === 314).map((p) => p.id);
    expect(new Set(packetIds).size).toBe(packetIds.length);
    expect(help.current!.status).toBe('sending');

    // Bob's app comes back and answers the next retry.
    bob!.receipts.start();
    await tick(5 * MIN);
    expect(help.current).toMatchObject({
      status: 'acknowledged',
      acknowledgedBy: [bob!.client.myNodeNum],
    });
    const copiesWhenAcked = onAir(air, AppMessageType.HelpRequest).length;

    await tick(2 * HOUR);
    expect(onAir(air, AppMessageType.HelpRequest)).toHaveLength(copiesWhenAcked);
    expect(states.at(-1)!.status).toBe('acknowledged');
  });

  it('is acknowledged quickly when the party is listening', async () => {
    const { phones } = await party();
    const help = requester(phones[0]!);
    help.ask();
    await tick(10_000);
    expect(help.current!.status).toBe('acknowledged');
    expect(help.current!.attempts).toBe(1);
    expect(help.current!.acknowledgedBy).toHaveLength(2);
  });

  it('never stops on its own: keeps retrying for hours, at most every 5 minutes', async () => {
    const { phones, air } = await party({ size: 2 });
    phones[1]!.receipts.stop();
    const help = requester(phones[0]!);
    help.ask();
    await tick(3 * HOUR);
    const copies = onAir(air, AppMessageType.HelpRequest).length;
    expect(help.current!.status).toBe('sending');
    // 3 h at ≤ 6 min (5 min + 20% jitter) apart, after the first few short gaps.
    expect(copies).toBeGreaterThanOrEqual(30);
    expect(copies).toBeLessThan(50);
  });

  it('cancel() stops retries; a later ask() starts a new request', async () => {
    const { phones, air } = await party({ size: 2 });
    phones[1]!.receipts.stop();
    const help = requester(phones[0]!);
    const a = help.ask();
    expect(help.ask().id).toBe(a.id); // idempotent while active
    await tick(MIN);
    help.cancel();
    const n = onAir(air, AppMessageType.HelpRequest).length;
    await tick(HOUR);
    expect(onAir(air, AppMessageType.HelpRequest)).toHaveLength(n);
    expect(help.current!.status).toBe('cancelled');
    expect(help.ask().id).not.toBe(a.id);
    help.dispose();
  });

  it('sends the current location (not just the stand), mode and note', async () => {
    const { phones, air } = await party({ size: 2, clubModes: true });
    const alice = phones[0]!;
    alice.checkIns.checkIn({ mode: CheckInMode.Stand, standId: 7, pin: HOME });
    requester(alice).ask('Fell, ankle');
    await tick(5000);
    expect(onAir(air, AppMessageType.HelpRequest)[0]).toMatchObject({
      mode: CheckInMode.Stand,
      standId: 7,
      pin: { lat: HERE.lat, lon: HERE.lon },
      note: 'Fell, ankle',
    });
  });

  it('falls back to the check-in pin when there is no GPS fix', async () => {
    const { phones, air } = await party({ size: 2 });
    const alice = phones[0]!;
    alice.checkIns.checkIn({ mode: CheckInMode.Spot, pin: HOME });
    requester(alice, () => undefined).ask();
    await tick(5000);
    expect(onAir(air, AppMessageType.HelpRequest)[0]!.pin).toEqual({
      lat: HOME.lat,
      lon: HOME.lon,
    });
  });

  it('does not pile copies into the radio queue while the radio is unreachable', async () => {
    const { phones } = await party({ size: 2 });
    const alice = phones[0]!;
    alice.radio.dropLink();
    const help = requester(alice);
    help.ask();
    await tick(HOUR);
    expect(alice.client.pendingCount).toBe(1);
    expect(help.current!.attempts).toBe(1);
    // Link back: the queued copy goes out and the party answers.
    alice.radio.restoreLink();
    await tick(10_000);
    expect(help.current!.status).toBe('acknowledged');
  });

  it('backs off harder when the radio reports a duty-cycle limit', async () => {
    const { phones } = await party({ size: 2 });
    const alice = phones[0]!;
    phones[1]!.receipts.stop();
    alice.radio.ackMode = 'none';
    const sendTimes: number[] = [];
    const orig = alice.client.sendAppMessage.bind(alice.client);
    alice.client.sendAppMessage = (m, o) => {
      sendTimes.push(Date.now());
      const h = orig(m, o);
      // The radio answers each copy with DUTY_CYCLE_LIMIT.
      void Promise.resolve().then(() =>
        alice.radio.injectRouting(h.id, Protobufs.Mesh.Routing_Error.DUTY_CYCLE_LIMIT),
      );
      return h;
    };
    const help = requester(alice);
    help.ask();
    await tick(30 * MIN);
    const gaps = sendTimes.slice(1).map((t, i) => t - sendTimes[i]!);
    // Normal schedule would be ~20, 40, 80 s...; with the penalty each gap is
    // at least double the normal one (minus jitter).
    gaps.slice(0, 3).forEach((g, i) => expect(g).toBeGreaterThan(helpRetryDelay(i + 1) * 2 * 0.8));
  });

  it('throws before the radio is connected', async () => {
    const offline = { myNodeNum: 0, on: () => () => {} } as unknown as MeshClient;
    const h = new HelpRequester({ client: offline }, { getLocation: () => HERE });
    expect(() => h.ask()).toThrow('Radio not connected yet');
  });
});
