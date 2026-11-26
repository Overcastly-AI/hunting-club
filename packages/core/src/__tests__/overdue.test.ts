import { AppMessageType, CheckInMode } from '@huntclub/mesh';
import { collect, tick } from '@huntclub/mesh/testing';
import { DEFAULT_OVERDUE_GRACE_MINUTES, OverdueMonitor, nodeLocation, overdueAt } from '../overdue';
import { HOME, HOUR, MIN, T0, fixedSun, onAir, party, type Phone } from '../testing/party';

beforeEach(() => jest.useFakeTimers({ now: T0 }));
afterEach(() => jest.useRealTimers());

/** fixedSun(): sunset 23:00 UTC, so with 30 min grace the deadline is 23:30 UTC. */
const SUNSET = Date.UTC(2026, 10, 26, 23);
const DEADLINE = SUNSET + DEFAULT_OVERDUE_GRACE_MINUTES * MIN;

function monitor(p: Phone, opts: Partial<ConstructorParameters<typeof OverdueMonitor>[1]> = {}) {
  return new OverdueMonitor(p.ctx, {
    checkIns: p.checkIns,
    board: p.board,
    sun: fixedSun(),
    locationOf: () => HOME,
    ...opts,
  }).start();
}

describe('overdueAt', () => {
  const sun = fixedSun();

  it('is sunset plus the grace time on the day of the check-in', () => {
    expect(overdueAt(T0, HOME, 30, sun)).toBe(DEADLINE);
    expect(overdueAt(T0, HOME, 0, sun)).toBe(SUNSET);
    expect(overdueAt(T0, HOME, 90, sun)).toBe(SUNSET + 90 * MIN);
  });

  it("uses the next day's sunset for a check-in after tonight's deadline", () => {
    expect(overdueAt(DEADLINE + MIN, HOME, 30, sun)).toBe(DEADLINE + 24 * HOUR);
  });

  it('is undefined when the sun does not set or rise', () => {
    expect(overdueAt(T0, HOME, 30, fixedSun(23, 'polarDay'))).toBeUndefined();
    expect(overdueAt(T0, HOME, 30, fixedSun(23, 'polarNight'))).toBeUndefined();
  });

  it('passes the place to the sun calculation', () => {
    const calls: [number, number][] = [];
    const spy = {
      ...sun,
      sunTimes: (d: Parameters<typeof sun.sunTimes>[0], lat: number, lon: number) => {
        calls.push([lat, lon]);
        return sun.sunTimes(d, lat, lon);
      },
    };
    overdueAt(T0, { lat: 45.5, lon: -93.1 }, 30, spy);
    expect(calls).toEqual([[45.5, -93.1]]);
  });
});

describe('OverdueMonitor', () => {
  it('fires for us at sunset + grace, and the party hears one OverdueAlert', async () => {
    const { phones, air } = await party();
    const alice = phones[0];
    const monitors = phones.map((p) => monitor(p));
    const events = monitors.map((m) => collect(m, 'overdue'));
    alice!.checkIns.checkIn({ mode: CheckInMode.Spot, pin: HOME });

    await tick(DEADLINE - T0 - MIN);
    expect(events.flat()).toEqual([]);
    expect(onAir(air, AppMessageType.OverdueAlert)).toEqual([]);

    await tick(2 * MIN + 2 * MIN); // past the deadline (+ any alert jitter is irrelevant for self)
    expect(events[0]).toEqual([
      expect.objectContaining({ subject: alice!.client.myNodeNum, self: true, source: 'detected' }),
    ]);
    // Bob and Carol get exactly one event each (heard or detected, not both).
    for (const e of [events[1]!, events[2]!]) {
      expect(e).toHaveLength(1);
      expect(e[0]).toMatchObject({ subject: alice!.client.myNodeNum, self: false });
    }
    await tick(5 * MIN);
    const alerts = onAir(air, AppMessageType.OverdueAlert);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      subject: alice!.client.myNodeNum,
      checkInId: alice!.checkIns.current!.messageId,
      mode: CheckInMode.Spot,
      pin: { lat: HOME.lat, lon: HOME.lon },
    });
  });

  it("when the hunter's phone is silent, only one of the others sends the alert", async () => {
    const { phones, air } = await party();
    const [alice, bob, carol] = phones;
    alice!.checkIns.checkIn({ mode: CheckInMode.Moving });
    await tick(MIN);
    alice!.radio.dropLink(); // battery died
    const monitors = [bob!, carol!].map((p) => monitor(p));
    const events = monitors.map((m) => collect(m, 'overdue'));

    await tick(DEADLINE - Date.now() + 3 * MIN); // past the deadline + full alert jitter
    const alerts = onAir(air, AppMessageType.OverdueAlert);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.subject).toBe(alice!.client.myNodeNum);
    expect([bob!.client.myNodeNum, carol!.client.myNodeNum]).toContain(alerts[0]!.sender);
    for (const e of events) {
      expect(e).toHaveLength(1);
      expect(e[0]).toMatchObject({ subject: alice!.client.myNodeNum, source: 'detected' });
    }
    // Nothing more later.
    await tick(HOUR);
    expect(onAir(air, AppMessageType.OverdueAlert)).toHaveLength(1);
  });

  it('no alert when the hunter checks out before the deadline', async () => {
    const { phones, air } = await party();
    phones.forEach((p) => monitor(p));
    phones[0]!.checkIns.checkIn({ mode: CheckInMode.Spot, pin: HOME });
    await tick(DEADLINE - T0 - 10 * MIN);
    phones[0]!.checkIns.checkOut();
    await tick(2 * HOUR);
    expect(onAir(air, AppMessageType.OverdueAlert)).toEqual([]);
  });

  it('a mode change does not reset the deadline', async () => {
    const { phones, air } = await party({ size: 2 });
    const m = monitor(phones[0]!);
    const events = collect(m, 'overdue');
    phones[0]!.checkIns.checkIn({ mode: CheckInMode.Spot, pin: HOME });
    await tick(DEADLINE - T0 - 5 * MIN);
    phones[0]!.checkIns.checkIn({ mode: CheckInMode.Moving });
    await tick(10 * MIN);
    expect(events).toHaveLength(1);
    expect(onAir(air, AppMessageType.OverdueAlert)).toHaveLength(1);
  });

  it('honours a club grace time', async () => {
    const { phones } = await party({ size: 2 });
    const m = monitor(phones[0]!, { graceMinutes: 60 });
    const events = collect(m, 'overdue');
    phones[0]!.checkIns.checkIn({ mode: CheckInMode.Moving });
    await tick(SUNSET + 59 * MIN - T0);
    expect(events).toEqual([]);
    await tick(2 * MIN);
    expect(events).toHaveLength(1);
    m.stop();
  });

  it('cannot compute a deadline without a location', async () => {
    const { phones } = await party({ size: 2 });
    const m = monitor(phones[0]!, { locationOf: () => undefined });
    const events = collect(m, 'overdue');
    phones[0]!.checkIns.checkIn({ mode: CheckInMode.Moving });
    await tick(24 * HOUR);
    expect(events).toEqual([]);
  });

  it('defaults to node DB positions for location', async () => {
    const { phones } = await party({ size: 2 });
    const alice = phones[0]!;
    expect(nodeLocation(alice.client, alice.client.myNodeNum)).toBeUndefined();
    alice.radio.injectFromRadio({
      payloadVariant: {
        case: 'nodeInfo',
        value: {
          num: alice.client.myNodeNum,
          position: { latitudeI: 460000000, longitudeI: -940000000 },
        },
      },
    });
    await tick();
    expect(nodeLocation(alice.client, alice.client.myNodeNum)).toEqual({ lat: 46, lon: -94 });
    const m = new OverdueMonitor(alice.ctx, {
      checkIns: alice.checkIns,
      board: alice.board,
      sun: fixedSun(),
    }).start();
    const events = collect(m, 'overdue');
    alice.checkIns.checkIn({ mode: CheckInMode.Moving });
    await tick(DEADLINE - T0 + 2 * MIN);
    expect(events).toHaveLength(1);
    m.stop();
  });
});
