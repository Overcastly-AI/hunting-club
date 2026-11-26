import {
  CheckInMode,
  ChannelUrlError,
  decodeJoinUrl,
  encodeJoinUrl,
  generatePartyChannelSet,
} from '@huntclub/mesh';
import { collect, seededRandom, tick } from '@huntclub/mesh/testing';
import { CORE_CONFIG } from '../config';
import { FREE_PARTY_MAX_MEMBERS, PartyFullError } from '../party';
import { PartyError, PartyService, SOLO_CHANNEL_NAME } from '../partyService';
import { MemoryPartyStore } from '../partyStore';
import { MINUTE_MS } from '../config';
import { T0, party, type Phone } from '../testing/party';

beforeEach(() => jest.useFakeTimers({ now: T0 }));
afterEach(() => jest.useRealTimers());

const { discoveryMs } = CORE_CONFIG.party;

/** Four radios, each on its own private channel, each phone with a PartyService. */
async function fourHunters() {
  const { phones, air } = await party({ size: 4, separateChannels: true });
  const hunters = phones.map((p) => {
    const store = new MemoryPartyStore();
    return { ...p, store, party: new PartyService(p.ctx, { store }) };
  });
  return { hunters, air };
}

/** Runs a promise while advancing fake time until it settles. */
async function settle<T>(p: Promise<T>, ms = discoveryMs + 5_000): Promise<T> {
  let done = false;
  const out = p.finally(() => (done = true));
  out.catch(() => {}); // the caller asserts on it; don't report it as unhandled meanwhile
  for (let t = 0; t < ms && !done; t += 1_000) await tick(1_000);
  return out;
}

const nodesOf = (h: Phone & { party: PartyService }) =>
  h.party.current!.members.map((m) => m.node).sort();

describe('party lifecycle', () => {
  it('create → two others join by QR → everyone knows the roster; the QR hides when full', async () => {
    const { hunters } = await fourHunters();
    const [a, b, c] = hunters;
    const created = await settle(a!.party.create());
    expect(created).toMatchObject({ role: 'creator', size: 1, isFull: false, members: [] });
    expect(a!.radio.channels[0]!.settings!.psk).toHaveLength(32);
    expect(a!.radio.channels[0]!.settings!.moduleSettings?.positionPrecision).toBe(32);

    const qr = a!.party.qrLink()!;
    expect(qr.startsWith('huntclub://join?cs=')).toBe(true);
    const joinedB = await settle(b!.party.join(qr));
    expect(joinedB).toMatchObject({ id: created.id, role: 'member', size: 2 });
    expect(nodesOf(b!)).toEqual([a!.client.myNodeNum]);
    expect(nodesOf(a!)).toEqual([b!.client.myNodeNum]);

    // Carol scans the web form of the same code.
    await settle(c!.party.join(a!.party.qrLink('web')!));
    for (const h of [a!, b!, c!]) {
      expect(h.party.current).toMatchObject({
        id: created.id,
        size: FREE_PARTY_MAX_MEMBERS,
        isFull: true,
      });
    }
    expect(nodesOf(a!)).toEqual([b!.client.myNodeNum, c!.client.myNodeNum].sort());
    expect(a!.party.qrLink()).toBeNull();
    expect(b!.party.qrLink()).toBeNull();
    // Names come from node info.
    expect(a!.party.current!.members.every((m) => m.name)).toBe(true);
  });

  it('a 4th radio with an old QR code is refused and moved off the channel; the others are told', async () => {
    const { hunters, air } = await fourHunters();
    const [a, b, c, d] = hunters;
    await settle(a!.party.create());
    const oldQr = a!.party.qrLink()!; // a screenshot taken before the party filled up
    await settle(b!.party.join(oldQr));
    await settle(c!.party.join(oldQr));
    const over = collect(a!.party, 'overCapacity');

    await expect(settle(d!.party.join(oldQr))).rejects.toThrow(PartyFullError);
    expect(d!.party.current).toBeNull();
    expect(await d!.store.load()).toBeNull();
    expect(d!.radio.channels[0]!.settings!.name).toBe(SOLO_CHANNEL_NAME);
    expect(over).toHaveLength(1);
    expect(over[0]).toMatchObject({ size: 4, overCapacity: true });

    // Dave can no longer be heard on the party channel: Alice's text reaches B and C only.
    const before = air.log.length;
    const atDave = collect(d!.client, 'text');
    a!.client.sendText('Dave, are you there?');
    await tick(1000);
    expect(air.log.length).toBeGreaterThan(before);
    expect(atDave).toEqual([]);
  });

  it('members learned from check-ins and positions too, and last-heard is kept', async () => {
    const { hunters } = await fourHunters();
    const [a, b] = hunters;
    await settle(a!.party.create());
    await settle(b!.party.join(a!.party.qrLink()!));
    const firstHeard = a!.party.current!.members[0]!.lastHeard;
    await tick(10 * MINUTE_MS);
    b!.checkIns.checkIn({ mode: CheckInMode.Moving });
    await tick(1000);
    expect(a!.party.current!.members[0]!.lastHeard).toBeGreaterThan(firstHeard);
    expect(a!.party.current!.members[0]!.firstHeard).toBe(firstHeard);
  });

  it('persists through the store port and restores after an app restart', async () => {
    const { hunters } = await fourHunters();
    const [a, b] = hunters;
    await settle(a!.party.create());
    await settle(b!.party.join(a!.party.qrLink()!));
    const saved = (await a!.store.load())!;
    expect(saved).toMatchObject({ role: 'creator', channelIndex: 0 });
    expect(saved.members.map((m) => m.node)).toEqual([b!.client.myNodeNum]);
    // The stored link carries the same channel as the radio.
    expect(decodeJoinUrl(saved.joinLink).channelSet.settings[0]!.psk).toEqual(
      a!.radio.channels[0]!.settings!.psk,
    );

    a!.party.dispose();
    const restarted = new PartyService(a!.ctx, { store: a!.store });
    const restored = await restarted.restore();
    expect(restored).toMatchObject({ id: saved.id, size: 2 });
    expect(restarted.qrLink()).toBe(a!.party.qrLink());
  });

  it('leave(): radio moves to a fresh private channel, store cleared, the party no longer reaches us', async () => {
    const { hunters } = await fourHunters();
    const [a, b] = hunters;
    await settle(a!.party.create());
    await settle(b!.party.join(a!.party.qrLink()!));
    const partyKey = b!.radio.channels[0]!.settings!.psk;
    const changes = collect(b!.party, 'change');

    await settle(b!.party.leave());
    expect(b!.party.current).toBeNull();
    expect(changes.at(-1)).toBeNull();
    expect(await b!.store.load()).toBeNull();
    expect(b!.radio.channels[0]!.settings!.psk).not.toEqual(partyKey);
    const atBob = collect(b!.client, 'text');
    a!.client.sendText('still here?');
    await tick(1000);
    expect(atBob).toEqual([]);
    // Bob can start or join another party now.
    await settle(b!.party.join(a!.party.qrLink()!));
    expect(b!.party.current?.id).toBe(a!.party.current!.id);
  });

  it('refuses club links, bad links, a second party, and actions without a radio', async () => {
    const { hunters } = await fourHunters();
    const [a, b] = hunters;
    const cs = generatePartyChannelSet({ random: seededRandom(1) });
    const club = encodeJoinUrl({
      channelSet: cs,
      target: { kind: 'club', clubId: 'c1', inviteToken: 't' },
    });
    await expect(b!.party.join(club)).rejects.toMatchObject({ code: 'club-link' });
    await expect(b!.party.join('https://example.com/nope')).rejects.toThrow(ChannelUrlError);
    await expect(b!.party.leave()).rejects.toMatchObject({ code: 'not-in-party' });

    await settle(a!.party.create());
    await expect(a!.party.create()).rejects.toMatchObject({ code: 'already-in-party' });
    const other = encodeJoinUrl({ channelSet: cs, target: { kind: 'party', partyId: 'other' } });
    await expect(a!.party.join(other)).rejects.toBeInstanceOf(PartyError);
    // Re-scanning our own party's code is a no-op.
    await expect(settle(a!.party.join(a!.party.qrLink()!))).resolves.toMatchObject({
      id: a!.party.current!.id,
    });

    b!.radio.dropLink();
    await expect(b!.party.create()).rejects.toMatchObject({ code: 'radio-not-connected' });
  });

  it('one change at a time', async () => {
    const { hunters } = await fourHunters();
    const first = hunters[0]!.party.create();
    await expect(hunters[0]!.party.create()).rejects.toMatchObject({ code: 'busy' });
    await settle(first);
  });

  it('a radio that rejects the settings surfaces an error', async () => {
    const { hunters } = await fourHunters();
    hunters[0]!.radio.queueStatusRes = 1;
    await expect(settle(hunters[0]!.party.create())).rejects.toMatchObject({
      code: 'radio-rejected',
    });
    expect(hunters[0]!.party.current).toBeNull();
  });
});
