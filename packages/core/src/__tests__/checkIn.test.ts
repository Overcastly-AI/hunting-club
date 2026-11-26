import { AppMessageType, CheckInMode, type MeshClient } from '@huntclub/mesh';
import { collect, tick } from '@huntclub/mesh/testing';
import { CheckInController, CheckInError, SAME_OUTING_MS } from '../checkIn';
import { HOME, HOUR, MIN, T0, onAir, party } from '../testing/party';

beforeEach(() => jest.useFakeTimers({ now: T0 }));
afterEach(() => jest.useRealTimers());

describe('check-in', () => {
  it('checks in at a spot; the party sees it; location is shared only while checked in', async () => {
    const { phones } = await party();
    const [alice, bob, carol] = phones;
    const sharing = collect(alice!.checkIns, 'locationSharing');
    expect(alice!.checkIns.sharingLocation).toBe(false);

    alice!.checkIns.checkIn({ mode: CheckInMode.Spot, pin: HOME, name: 'Big oak' });
    await tick(1000);

    expect(alice!.checkIns.sharingLocation).toBe(true);
    for (const p of [bob!, carol!]) {
      expect(p.board.get(alice!.client.myNodeNum)).toMatchObject({
        mode: CheckInMode.Spot,
        pin: { lat: HOME.lat, lon: HOME.lon },
        since: T0,
      });
    }

    alice!.checkIns.checkOut();
    await tick(1000);
    expect(alice!.checkIns.sharingLocation).toBe(false);
    expect(alice!.checkIns.current).toBeNull();
    expect(bob!.board.all).toEqual([]);
    expect(carol!.board.all).toEqual([]);
    expect(sharing).toEqual([true, false]);
  });

  it('switches mode without checking out and keeps the check-in time', async () => {
    const { phones, air } = await party();
    const [alice, bob] = phones;
    alice!.checkIns.checkIn({ mode: CheckInMode.Spot, pin: HOME });
    await tick(30 * MIN);
    const first = alice!.checkIns.current!;
    alice!.checkIns.checkIn({ mode: CheckInMode.Moving });
    await tick(1000);

    const now = alice!.checkIns.current!;
    expect(now.placement.mode).toBe(CheckInMode.Moving);
    expect(now.checkedInAt).toBe(T0);
    expect(now.modeSince).toBe(T0 + 30 * MIN);
    expect(now.messageId).not.toBe(first.messageId);
    expect(bob!.board.get(alice!.client.myNodeNum)).toMatchObject({
      mode: CheckInMode.Moving,
      since: T0,
      checkInId: now.messageId,
    });
    // No CheckOut in between.
    expect(onAir(air, AppMessageType.CheckOut)).toHaveLength(0);
    expect(onAir(air, AppMessageType.CheckIn)).toHaveLength(2);

    alice!.checkIns.checkOut();
    await tick(1000);
    expect(onAir(air, AppMessageType.CheckOut)).toEqual([
      expect.objectContaining({ checkInId: now.messageId, sender: alice!.client.myNodeNum }),
    ]);
  });

  it('keeps CheckIn messages under the spec budget', async () => {
    const { phones, air } = await party({ size: 2, clubModes: true });
    phones[0]!.checkIns.checkIn({ mode: CheckInMode.Stand, standId: 12, pin: HOME });
    await tick(1000);
    expect(air.log.at(-1)!.data.payload.length).toBeLessThan(40);
  });

  it('allows stand and area only for clubs', async () => {
    const { phones } = await party({ size: 2 });
    expect(() => phones[0]!.checkIns.checkIn({ mode: CheckInMode.Stand, standId: 4 })).toThrow(
      CheckInError,
    );
    expect(() => phones[0]!.checkIns.checkIn({ mode: CheckInMode.Area, areaId: 2 })).toThrow(
      CheckInError,
    );

    const club = new CheckInController({ client: phones[0]!.client }, { clubModes: true });
    club.checkIn({ mode: CheckInMode.Stand, standId: 4 });
    club.checkIn({ mode: CheckInMode.Area, areaId: 2 });
    await tick(1000);
    expect(phones[1]!.board.get(phones[0]!.client.myNodeNum)).toMatchObject({
      mode: CheckInMode.Area,
      areaId: 2,
    });
  });

  it('validates placements and state', async () => {
    const { phones } = await party({ size: 2, clubModes: true });
    const c = phones[0]!.checkIns;
    expect(() => c.checkOut()).toThrow('Not checked in');
    expect(() => c.checkIn({ mode: CheckInMode.Stand, standId: 0 })).toThrow('Pick a stand');
    expect(() => c.checkIn({ mode: CheckInMode.Area, areaId: 0 })).toThrow('Pick an area');
    expect(() => c.checkIn({ mode: CheckInMode.Spot } as never)).toThrow('A spot needs a location');
  });

  it('refuses to check in before the radio is connected', async () => {
    const { phones } = await party({ size: 2 });
    const offline = { myNodeNum: 0 } as unknown as MeshClient;
    expect(() =>
      new CheckInController({ client: offline }).checkIn({ mode: CheckInMode.Moving }),
    ).toThrow('Radio not connected yet');
  });

  it('a new check-in long after a missed check-out starts a new outing', async () => {
    const { phones } = await party({ size: 2 });
    const [alice, bob] = phones;
    alice!.checkIns.checkIn({ mode: CheckInMode.Moving });
    await tick(1000);
    // Alice's CheckOut never reached Bob; the next morning she checks in again.
    const next = T0 + SAME_OUTING_MS + HOUR;
    jest.setSystemTime(next);
    alice!.checkIns.checkIn({ mode: CheckInMode.Moving });
    await tick(1000);
    expect(bob!.board.get(alice!.client.myNodeNum)!.since).toBe(next);
  });

  it('the party sends receipts for a check-in: delivered to 2 of 2', async () => {
    const { phones } = await party();
    const alice = phones[0]!;
    const deliveries = collect(alice.delivery, 'delivery');
    const h = alice.checkIns.checkIn({ mode: CheckInMode.Moving });
    alice.delivery.track(alice.checkIns.current!.messageId, 2);
    await expect(h.result).resolves.toMatchObject({ status: 'acked' });
    await tick(10_000);
    const state = alice.delivery.get(alice.checkIns.current!.messageId)!;
    expect(state.expected).toBe(2);
    expect(state.deliveredTo.sort()).toEqual(
      [phones[1]!.client.myNodeNum, phones[2]!.client.myNodeNum].sort(),
    );
    expect(deliveries).toHaveLength(2);
  });
});
