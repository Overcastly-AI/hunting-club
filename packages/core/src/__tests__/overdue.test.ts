import { AppMessageType, CheckInMode } from '@huntclub/mesh';
import { collect, tick } from '@huntclub/mesh/testing';
import { CORE_CONFIG } from '../config';
import { OverdueMonitor, nodeLocation, overdueAt, type OverdueOptions } from '../overdue';
import { HOUR_MS, MINUTE_MS } from '../config';
import { HOME, T0, fixedSun, onAir, party, type Phone } from '../testing/party';

beforeEach(() => jest.useFakeTimers({ now: T0 }));
afterEach(() => jest.useRealTimers());

const { graceMinutes, selfPromptMinutes, othersDelayMinutes, extendMinutes, alertJitterMs } =
  CORE_CONFIG.overdue;
/** fixedSun(): sunset 23:00 UTC, so with 30 min grace the deadline is 23:30 UTC. */
const SUNSET = Date.UTC(2026, 10, 26, 23);
const DEADLINE = SUNSET + graceMinutes * MINUTE_MS;
/** Our check loop runs every minute, so a deadline is noticed within a minute. */
const NOTICE = CORE_CONFIG.overdue.checkIntervalMs;

function monitor(p: Phone, opts: Partial<OverdueOptions> = {}) {
  return new OverdueMonitor(p.ctx, {
    checkIns: p.checkIns,
    board: p.board,
    sun: fixedSun(),
    locationOf: () => HOME,
    ...opts,
  }).start();
}

/** Advance fake time to an absolute moment. */
const until = (at: number) => tick(at - Date.now());

describe('overdueAt', () => {
  const sun = fixedSun();

  it('is sunset plus the grace time on the day of the check-in', () => {
    expect(overdueAt(T0, HOME, 30, sun)).toBe(DEADLINE);
    expect(overdueAt(T0, HOME, 0, sun)).toBe(SUNSET);
    expect(overdueAt(T0, HOME, 90, sun)).toBe(SUNSET + 90 * MINUTE_MS);
  });

  it("uses the next day's sunset for a check-in after tonight's deadline", () => {
    expect(overdueAt(DEADLINE + MINUTE_MS, HOME, 30, sun)).toBe(DEADLINE + 24 * HOUR_MS);
  });

  it('an extension moves the deadline later, never earlier', () => {
    expect(overdueAt(T0, HOME, 30, sun, DEADLINE + HOUR_MS)).toBe(DEADLINE + HOUR_MS);
    expect(overdueAt(T0, HOME, 30, sun, T0 + HOUR_MS)).toBe(DEADLINE);
  });

  it('is undefined when the sun does not set or rise, unless extended', () => {
    expect(overdueAt(T0, HOME, 30, fixedSun(23, 'polarDay'))).toBeUndefined();
    expect(overdueAt(T0, HOME, 30, fixedSun(23, 'polarNight'))).toBeUndefined();
    expect(overdueAt(T0, HOME, 30, fixedSun(23, 'polarDay'), T0 + HOUR_MS)).toBe(T0 + HOUR_MS);
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

describe('our own deadline: prompt first', () => {
  it('prompts at the deadline and sends nothing while waiting for an answer', async () => {
    const { phones, air } = await party();
    const m = monitor(phones[0]!);
    const prompts = collect(m, 'selfPrompt');
    phones[0]!.checkIns.checkIn({ mode: CheckInMode.Spot, pin: HOME });
    await until(DEADLINE - MINUTE_MS);
    expect(prompts).toEqual([]);
    await until(DEADLINE + NOTICE);
    expect(prompts).toHaveLength(1);
    expect(prompts[0]!.overdueAt).toBe(DEADLINE);
    expect(prompts[0]!.alertAt - DEADLINE).toBeLessThanOrEqual(
      selfPromptMinutes * MINUTE_MS + NOTICE,
    );
    await tick(selfPromptMinutes * MINUTE_MS - NOTICE - MINUTE_MS);
    expect(onAir(air, AppMessageType.OverdueAlert)).toEqual([]);
  });

  it('responds by checking out: no alert, ever', async () => {
    const { phones, air } = await party();
    const ms = phones.map((p) => monitor(p));
    const cleared = collect(ms[0]!, 'selfPromptCleared');
    const overdue = ms.map((m) => collect(m, 'overdue'));
    phones[0]!.checkIns.checkIn({ mode: CheckInMode.Moving });
    await until(DEADLINE + 3 * MINUTE_MS);
    phones[0]!.checkIns.checkOut();
    await tick(3 * HOUR_MS);
    expect(cleared).toEqual([{ reason: 'checkedOut' }]);
    expect(overdue.flat()).toEqual([]);
    expect(onAir(air, AppMessageType.OverdueAlert)).toEqual([]);
  });

  it('extends: new deadline for everyone, then prompts again at it', async () => {
    const { phones, air } = await party();
    const [alice, bob, carol] = phones;
    const ms = phones.map((p) => monitor(p));
    const prompts = collect(ms[0]!, 'selfPrompt');
    const cleared = collect(ms[0]!, 'selfPromptCleared');
    const others = [collect(ms[1]!, 'overdue'), collect(ms[2]!, 'overdue')];
    alice!.checkIns.checkIn({ mode: CheckInMode.Spot, pin: HOME });
    await until(DEADLINE + 3 * MINUTE_MS);
    expect(prompts).toHaveLength(1);

    ms[0]!.extend(); // "Still out? Extend 30 min"
    const extendedTo = Date.now() + extendMinutes * MINUTE_MS;
    await tick(1000);
    expect(cleared).toEqual([{ reason: 'extended' }]);
    expect(ms[0]!.selfDeadline).toBe(extendedTo);
    for (const p of [bob!, carol!]) {
      expect(p.board.get(alice!.client.myNodeNum)!.until).toBe(
        Math.floor(extendedTo / 1000) * 1000,
      );
    }

    // Past the old deadline + the others' wait: nobody alerts.
    await until(DEADLINE + othersDelayMinutes * MINUTE_MS + alertJitterMs + 2 * MINUTE_MS);
    expect(others.flat()).toEqual([]);
    expect(onAir(air, AppMessageType.OverdueAlert)).toEqual([]);

    // At the new deadline Alice is asked again.
    await until(extendedTo + NOTICE);
    expect(prompts).toHaveLength(2);
    expect(prompts[1]!.overdueAt).toBe(extendedTo);
  });

  it('silent: the alert goes out after the prompt time, once, and the party hears it', async () => {
    const { phones, air } = await party();
    const [alice] = phones;
    const ms = phones.map((p) => monitor(p));
    const events = ms.map((m) => collect(m, 'overdue'));
    alice!.checkIns.checkIn({ mode: CheckInMode.Spot, pin: HOME });

    await until(DEADLINE + selfPromptMinutes * MINUTE_MS - MINUTE_MS);
    expect(onAir(air, AppMessageType.OverdueAlert)).toEqual([]);
    await until(DEADLINE + selfPromptMinutes * MINUTE_MS + NOTICE + MINUTE_MS);

    const alerts = onAir(air, AppMessageType.OverdueAlert);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      sender: alice!.client.myNodeNum,
      subject: alice!.client.myNodeNum,
      checkInId: alice!.checkIns.current!.messageId,
      mode: CheckInMode.Spot,
      pin: { lat: HOME.lat, lon: HOME.lon },
    });
    expect(events[0]).toEqual([
      expect.objectContaining({ subject: alice!.client.myNodeNum, self: true, source: 'detected' }),
    ]);
    for (const e of [events[1]!, events[2]!]) {
      expect(e).toEqual([
        expect.objectContaining({ subject: alice!.client.myNodeNum, source: 'heard' }),
      ]);
    }
    await tick(2 * HOUR_MS);
    expect(onAir(air, AppMessageType.OverdueAlert)).toHaveLength(1);
  });
});

describe("others' deadlines", () => {
  it("when the hunter's phone is silent, one of the others alerts after the wait", async () => {
    const { phones, air } = await party();
    const [alice, bob, carol] = phones;
    alice!.checkIns.checkIn({ mode: CheckInMode.Moving });
    await tick(MINUTE_MS);
    alice!.radio.dropLink(); // battery died
    const ms = [bob!, carol!].map((p) => monitor(p));
    const events = ms.map((m) => collect(m, 'overdue'));

    await until(DEADLINE + othersDelayMinutes * MINUTE_MS - MINUTE_MS);
    expect(events.flat()).toEqual([]);
    await until(DEADLINE + othersDelayMinutes * MINUTE_MS + NOTICE + alertJitterMs + MINUTE_MS);

    const alerts = onAir(air, AppMessageType.OverdueAlert);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.subject).toBe(alice!.client.myNodeNum);
    expect([bob!.client.myNodeNum, carol!.client.myNodeNum]).toContain(alerts[0]!.sender);
    for (const e of events) {
      expect(e).toEqual([
        expect.objectContaining({ subject: alice!.client.myNodeNum, source: 'detected' }),
      ]);
    }
    await tick(HOUR_MS);
    expect(onAir(air, AppMessageType.OverdueAlert)).toHaveLength(1);
  });

  it('no alert when the hunter checks out before the deadline', async () => {
    const { phones, air } = await party();
    phones.forEach((p) => monitor(p));
    phones[0]!.checkIns.checkIn({ mode: CheckInMode.Spot, pin: HOME });
    await until(DEADLINE - 10 * MINUTE_MS);
    phones[0]!.checkIns.checkOut();
    await tick(2 * HOUR_MS);
    expect(onAir(air, AppMessageType.OverdueAlert)).toEqual([]);
  });

  it('a mode change does not reset the deadline', async () => {
    const { phones } = await party({ size: 2 });
    const m = monitor(phones[0]!);
    const prompts = collect(m, 'selfPrompt');
    phones[0]!.checkIns.checkIn({ mode: CheckInMode.Spot, pin: HOME });
    await until(DEADLINE - 5 * MINUTE_MS);
    phones[0]!.checkIns.checkIn({ mode: CheckInMode.Moving });
    await until(DEADLINE + 2 * MINUTE_MS);
    expect(prompts).toEqual([expect.objectContaining({ overdueAt: DEADLINE })]);
  });
});

describe('configuration and location', () => {
  it("honours the club's grace time", async () => {
    const { phones } = await party({ size: 2 });
    const m = monitor(phones[0]!, { config: { graceMinutes: 60 } });
    const prompts = collect(m, 'selfPrompt');
    phones[0]!.checkIns.checkIn({ mode: CheckInMode.Moving });
    await until(SUNSET + 59 * MINUTE_MS);
    expect(prompts).toEqual([]);
    await until(SUNSET + 61 * MINUTE_MS);
    expect(prompts).toHaveLength(1);
    m.stop();
  });

  it('cannot compute a deadline without a location', async () => {
    const { phones } = await party({ size: 2 });
    const m = monitor(phones[0]!, { locationOf: () => undefined });
    const prompts = collect(m, 'selfPrompt');
    phones[0]!.checkIns.checkIn({ mode: CheckInMode.Moving });
    await tick(24 * HOUR_MS);
    expect(prompts).toEqual([]);
    expect(m.selfDeadline).toBeUndefined();
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
    alice.checkIns.checkIn({ mode: CheckInMode.Moving });
    expect(m.selfDeadline).toBe(DEADLINE);
    m.stop();
  });
});
