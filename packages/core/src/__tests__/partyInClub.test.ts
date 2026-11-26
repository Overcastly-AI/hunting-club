// Parties inside a club (spec "Free vs Club": whole-club chat plus parties): the party
// is a secondary channel next to the club's primary, which it never disturbs, and has
// no size cap. Four club members over FakeAir.
import { Protobufs, generatePartyChannelSet } from '@huntclub/mesh';

const { Channel } = Protobufs;
import { seededRandom, tick } from '@huntclub/mesh/testing';
import { CORE_CONFIG } from '../config';
import { CLUB_PARTY_CHANNEL, PartyService } from '../partyService';
import { MemoryPartyStore } from '../partyStore';
import { applyChannelSet } from '../radioChannels';
import { T0, party } from '../testing/party';

beforeEach(() => jest.useFakeTimers({ now: T0 }));
afterEach(() => jest.useRealTimers());

const CLUB = generatePartyChannelSet({ random: seededRandom(0xc1ab), name: 'Club' });
const clubKey = CLUB.settings[0]!.psk;

async function settle<T>(p: Promise<T>, ms = CORE_CONFIG.party.discoveryMs + 5_000): Promise<T> {
  let done = false;
  const out = p.finally(() => (done = true));
  out.catch(() => {});
  for (let t = 0; t < ms && !done; t += 1_000) await tick(1_000);
  return out;
}

/** Four hunters whose radios already carry the club channel as primary. */
async function clubMembers() {
  const { phones } = await party({ size: 4, separateChannels: true });
  for (const p of phones) await settle(applyChannelSet(p.client, CLUB));
  return phones.map((p) => ({
    ...p,
    party: new PartyService(p.ctx, { store: new MemoryPartyStore(), clubChannelSet: CLUB }),
  }));
}

it('creates and joins a club party on a secondary channel; the club channel stays primary', async () => {
  const [a, b, c, d] = await clubMembers();
  const created = await settle(a!.party.create());
  for (const h of [b!, c!, d!]) await settle(h.party.join(a!.party.qrLink()!));

  for (const h of [a!, b!, c!, d!]) {
    expect(h.radio.channels[0]!.settings!.psk).toEqual(clubKey);
    expect(h.radio.channels[0]!.role).toBe(Channel.Channel_Role.PRIMARY);
    expect(h.radio.channels[CLUB_PARTY_CHANNEL]!.role).toBe(Channel.Channel_Role.SECONDARY);
  }
  const partyKey = a!.radio.channels[CLUB_PARTY_CHANNEL]!.settings!.psk;
  expect(d!.radio.channels[CLUB_PARTY_CHANNEL]!.settings!.psk).toEqual(partyKey);
  expect(partyKey).not.toEqual(clubKey);

  // No cap inside a club: four people, the QR code still shows.
  expect(a!.party.current).toMatchObject({
    id: created.id,
    size: 4,
    isFull: false,
    overCapacity: false,
  });
  expect(a!.party.qrLink()).not.toBeNull();
});

it('leaving a club party keeps the club channel and drops only the party channel', async () => {
  const [a, b] = await clubMembers();
  await settle(a!.party.create());
  await settle(b!.party.join(a!.party.qrLink()!));
  await settle(b!.party.leave());
  expect(b!.party.current).toBeNull();
  expect(b!.radio.channels[0]!.settings!.psk).toEqual(clubKey);
  expect(b!.radio.channels[CLUB_PARTY_CHANNEL]!.role).toBe(Channel.Channel_Role.DISABLED);
});
