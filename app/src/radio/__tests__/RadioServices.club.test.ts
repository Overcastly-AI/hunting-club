// RadioServices in a club: club check-in places, the board's stands, whole-club chat
// and the club channels put on the radio (over the mesh FakeRadio, no Bluetooth).
import { CLUB_PARTY_CHANNEL } from '@huntclub/core';
import { party } from '@huntclub/core/testing';
import { generatePartyChannelSet } from '@huntclub/mesh';
import { connectedMesh, seededRandom, tick } from '@huntclub/mesh/testing';

import {
  DEFAULT_SERVICES_OPTIONS,
  type RadioClub,
  RadioServices,
  type RadioServicesOptions,
} from '../RadioServices';

// Simulated time: the radio writes' pacing (200 ms each) passes instantly.
beforeEach(() => jest.useFakeTimers());
const created: RadioServices[] = [];
afterEach(() => {
  for (const s of created.splice(0)) s.dispose();
  jest.useRealTimers();
});

/** How putting the club channels on the radio ended, once its writes have had time. */
async function clubChannelOf(s: RadioServices) {
  const outcome = s.clubChannel;
  await tick(10_000);
  return outcome;
}

const club = (overrides: Partial<RadioClub> = {}): RadioClub => ({
  clubId: '00000000-0000-4000-8000-00000000c1ab',
  graceMinutes: 45,
  stands: [{ meshId: 1, name: 'Creek Stand', position: { lat: 40, lon: -90 } }],
  areas: [{ meshId: 1, name: 'North 40' }],
  channelSet: generatePartyChannelSet({ random: seededRandom(42), name: 'Club' }),
  ...overrides,
});

async function services(clubInfo?: RadioClub) {
  const { phones } = await party({ size: 2 });
  const phone = phones[0]!;
  const s = new RadioServices(phone.client, {
    ...DEFAULT_SERVICES_OPTIONS,
    ...(clubInfo ? { club: clubInfo } : {}),
  });
  created.push(s);
  for (const p of phones) p.receipts.stop();
  return { s, client: phone.client, radio: phone.radio };
}

it('switches every screen to the club: audience, grace time, places, board, chat', async () => {
  const { s } = await services(club());
  expect(s.checkInRadio).toMatchObject({
    audience: 'club',
    graceMinutes: 45,
    club: { stands: club().stands, areas: club().areas },
  });
  expect(s.safetyRadio.audience).toBe('club');
  expect(s.boardRadio.stands).toEqual(club().stands);
  expect(s.chatRadio.segmentOfChannel(0)).toBe('club');
  // A party inside the club is the secondary channel, for chat and harvest shares.
  expect(s.chatRadio.channelOf('club')).toBe(0);
  expect(s.chatRadio.channelOf('party')).toBe(CLUB_PARTY_CHANNEL);
  expect(s.chatRadio.segmentOfChannel(CLUB_PARTY_CHANNEL)).toBe('party');
  expect(s.harvestRadio.channelOf('party')).toBe(CLUB_PARTY_CHANNEL);
  expect(s.harvestRadio.audience).toBe('club');
});

it('puts the club channels on the radio when it has others', async () => {
  const info = club();
  const { s, radio } = await services(info);
  expect(await clubChannelOf(s)).toBe('applied');
  expect(radio.channels[0]!.settings!.psk).toEqual(info.channelSet!.settings[0]!.psk);
});

it('leaves a radio alone that already has the club channels', async () => {
  const info = club();
  const { clients } = await connectedMesh([
    { nodeNum: 0x1234, channels: info.channelSet!.settings },
  ]);
  const s = new RadioServices(clients[0], { ...DEFAULT_SERVICES_OPTIONS, club: info });
  created.push(s);
  expect(await clubChannelOf(s)).toBe('already');
});

it('stays a free party without a club', async () => {
  const { s } = await services();
  expect(s.checkInRadio.audience).toBe('party');
  expect(s.checkInRadio.club).toBeUndefined();
  expect(s.chatRadio.segmentOfChannel(0)).toBe('party');
  expect(s.chatRadio.channelOf('party')).toBe(0);
  expect(await clubChannelOf(s)).toBe('already');
});

describe('after a user switch (the club channel follows the signed-in account)', () => {
  const clubA = club({ clubId: '00000000-0000-4000-8000-0000000000a1' });
  const clubB = club({
    clubId: '00000000-0000-4000-8000-0000000000b1',
    channelSet: generatePartyChannelSet({ random: seededRandom(7), name: 'Club' }),
  });
  const pskOf = (set: RadioClub['channelSet']) => set!.settings[0]!.psk;
  /** A radio still on A's club channel, as account A left it. */
  async function radioOnA(options: Partial<RadioServicesOptions>) {
    const { clients, radios } = await connectedMesh([
      { nodeNum: 0x1234, channels: clubA.channelSet!.settings },
    ]);
    const provision = jest.spyOn(clients[0], 'provision');
    const s = new RadioServices(clients[0], { ...DEFAULT_SERVICES_OPTIONS, ...options });
    created.push(s);
    /** Every primary key the services wrote to the radio. */
    const written = () => provision.mock.calls.map(([plan]) => plan.channels[0]?.psk);
    return { s, radio: radios[0], written };
  }

  it("A to B: B's club replaces A's on the radio, and A's key is never written", async () => {
    const { s, radio, written } = await radioOnA({
      club: clubB,
      hiddenClubChannels: [clubA.channelSet!],
    });
    expect(await clubChannelOf(s)).toBe('applied');
    expect(radio.channels[0]!.settings!.psk).toEqual(pskOf(clubB.channelSet));
    expect(written()).not.toContainEqual(pskOf(clubA.channelSet));
  });

  it("A to B with no club: A's channel comes off, only a party channel is used", async () => {
    const { s, radio, written } = await radioOnA({ hiddenClubChannels: [clubA.channelSet!] });
    expect(await clubChannelOf(s)).toBe('removed');
    expect(radio.channels[0]!.settings!.psk).not.toEqual(pskOf(clubA.channelSet));
    expect(written()).not.toContainEqual(pskOf(clubA.channelSet));
    expect(s.checkInRadio.audience).toBe('party');
    expect(s.chatRadio.segmentOfChannel(0)).toBe('party');
  });

  it("A comes back: A's club is used again (already on the radio)", async () => {
    const { s, radio, written } = await radioOnA({ club: clubA });
    expect(await clubChannelOf(s)).toBe('already');
    expect(radio.channels[0]!.settings!.psk).toEqual(pskOf(clubA.channelSet));
    expect(written()).toEqual([]);
    expect(s.checkInRadio.audience).toBe('club');
  });

  it('no club, radio on its party channel: the party channel is left alone', async () => {
    const { phones } = await party({ size: 2 });
    const client = phones[0]!.client;
    const before = client.channels.get(0)?.settings?.psk;
    const provision = jest.spyOn(client, 'provision');
    const s = new RadioServices(client, {
      ...DEFAULT_SERVICES_OPTIONS,
      hiddenClubChannels: [clubA.channelSet!],
    });
    created.push(s);
    for (const p of phones) p.receipts.stop();
    expect(await clubChannelOf(s)).toBe('already');
    expect(provision).not.toHaveBeenCalled();
    expect(client.channels.get(0)?.settings?.psk).toEqual(before);
  });
});
