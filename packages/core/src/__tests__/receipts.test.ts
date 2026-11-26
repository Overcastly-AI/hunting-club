import { AppMessageType, CheckInMode } from '@huntclub/mesh';
import { collect, tick } from '@huntclub/mesh/testing';
import { DEFAULT_RECEIPT_POLICY, DeliveryTracker } from '../receipts';
import { MIN, T0, onAir, party } from '../testing/party';

beforeEach(() => jest.useFakeTimers({ now: T0 }));
afterEach(() => jest.useRealTimers());

describe('receipts', () => {
  it('everyone who gets a text sends one receipt: delivered to 2 of 2', async () => {
    const { phones, air } = await party();
    const [alice, bob, carol] = phones;
    const h = alice!.client.sendText('Coming down at dark');
    alice!.delivery.track(h.id, 2);
    await tick(DEFAULT_RECEIPT_POLICY.jitterMs + 1000);

    const receipts = onAir(air, AppMessageType.Receipt);
    expect(receipts.map((r) => r.sender).sort()).toEqual(
      [bob!.client.myNodeNum, carol!.client.myNodeNum].sort(),
    );
    expect(receipts.every((r) => r.ackedId === h.id)).toBe(true);
    expect(alice!.delivery.get(h.id)).toMatchObject({ expected: 2 });
    expect(alice!.delivery.get(h.id)!.deliveredTo).toHaveLength(2);
    expect(alice!.receipts.sent).toBe(0);
  });

  it('sends receipts for CheckIn and HelpRequest, not for Receipt, CheckOut or our own messages', async () => {
    const { phones, air } = await party({ size: 2 });
    const [alice, bob] = phones;
    alice!.checkIns.checkIn({ mode: CheckInMode.Moving });
    await tick(5000);
    alice!.checkIns.checkOut();
    await tick(5000);
    // Bob receipted the CheckIn only. Alice never receipts Bob's receipt.
    expect(bob!.receipts.sent).toBe(1);
    expect(alice!.receipts.sent).toBe(0);
    expect(onAir(air, AppMessageType.Receipt)).toHaveLength(1);
  });

  it('de-duplicates: rebroadcast copies of one message get one receipt', async () => {
    const { phones, air } = await party({ size: 2, air: { duplicates: 3 } });
    phones[0]!.client.sendText('once');
    await tick(5000);
    air.rebroadcast(0, 2);
    await tick(5000);
    expect(onAir(air, AppMessageType.Receipt)).toHaveLength(1);
  });

  it('rate-limits receipts per sender so a chatty sender cannot flood the air', async () => {
    const { phones, air } = await party({ size: 2 });
    const [alice, bob] = phones;
    for (let i = 0; i < 10; i++) alice!.client.sendText(`msg ${i}`);
    await tick(10_000);
    expect(onAir(air, AppMessageType.Receipt)).toHaveLength(DEFAULT_RECEIPT_POLICY.burst);
    expect(bob!.receipts.suppressed).toBe(10 - DEFAULT_RECEIPT_POLICY.burst);

    // The bucket refills over time.
    await tick(DEFAULT_RECEIPT_POLICY.refillMs * 2);
    alice!.client.sendText('later');
    await tick(10_000);
    expect(onAir(air, AppMessageType.Receipt)).toHaveLength(DEFAULT_RECEIPT_POLICY.burst + 1);
  });

  it('answers a retried message again, but not more than once a minute', async () => {
    const { phones, air } = await party({ size: 2 });
    const [alice] = phones;
    const help = {
      type: AppMessageType.HelpRequest,
      id: 0xabc,
      sender: alice!.client.myNodeNum,
    } as const;
    alice!.client.sendAppMessage(help);
    await tick(5000);
    alice!.client.sendAppMessage(help); // retry 10 s later: too soon
    await tick(5000);
    expect(onAir(air, AppMessageType.Receipt)).toHaveLength(1);
    await tick(DEFAULT_RECEIPT_POLICY.repeatMinMs);
    alice!.client.sendAppMessage(help); // retry after a minute: answered again
    await tick(5000);
    expect(onAir(air, AppMessageType.Receipt)).toHaveLength(2);
  });

  it('jitters receipts so the party does not transmit at the same moment', async () => {
    const { phones } = await party();
    const times: number[] = [];
    for (const p of phones.slice(1)) {
      const orig = p.client.sendAppMessage.bind(p.client);
      p.client.sendAppMessage = (m, o) => {
        times.push(Date.now());
        return orig(m, o);
      };
    }
    phones[0]!.client.sendText('hello');
    await tick(DEFAULT_RECEIPT_POLICY.jitterMs + 1000);
    expect(times).toHaveLength(2);
    expect(times[0]).not.toBe(times[1]);
    for (const t of times) expect(t - T0).toBeLessThan(DEFAULT_RECEIPT_POLICY.jitterMs + 1000);
  });

  it('stop() ends receipts; DeliveryTracker ignores untracked ids and repeat senders', async () => {
    const { phones } = await party({ size: 2 });
    const [alice, bob] = phones;
    const tracker = new DeliveryTracker(alice!.client);
    const events = collect(tracker, 'delivery');
    const h = alice!.client.sendText('a');
    tracker.track(h.id, 1);
    tracker.track(h.id, 5); // second track() keeps the first
    await tick(10_000);
    expect(events).toHaveLength(1);
    expect(tracker.get(h.id)?.expected).toBe(1);
    tracker.forget(h.id);
    expect(tracker.get(h.id)).toBeUndefined();

    bob!.receipts.stop();
    alice!.client.sendText('b');
    await tick(10 * MIN);
    expect(bob!.receipts.sent).toBe(1);
    tracker.dispose();
  });
});
