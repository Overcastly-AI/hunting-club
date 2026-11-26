// RadioServices in a club: club check-in places, the board's stands, whole-club chat
// and the club channels put on the radio (over the mesh FakeRadio, no Bluetooth).
import { CLUB_PARTY_CHANNEL } from '@huntclub/core';
import { party } from '@huntclub/core/testing';
import { generatePartyChannelSet } from '@huntclub/mesh';
import { connectedMesh, seededRandom } from '@huntclub/mesh/testing';

import { DEFAULT_SERVICES_OPTIONS, type RadioClub, RadioServices } from '../RadioServices';

const created: RadioServices[] = [];
afterEach(() => {
  for (const s of created.splice(0)) s.dispose();
});

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
  expect(await s.clubChannel).toBe('applied');
  expect(radio.channels[0]!.settings!.psk).toEqual(info.channelSet!.settings[0]!.psk);
});

it('leaves a radio alone that already has the club channels', async () => {
  const info = club();
  const { clients } = await connectedMesh([
    { nodeNum: 0x1234, channels: info.channelSet!.settings },
  ]);
  const s = new RadioServices(clients[0], { ...DEFAULT_SERVICES_OPTIONS, club: info });
  created.push(s);
  expect(await s.clubChannel).toBe('already');
});

it('stays a free party without a club', async () => {
  const { s } = await services();
  expect(s.checkInRadio.audience).toBe('party');
  expect(s.checkInRadio.club).toBeUndefined();
  expect(s.chatRadio.segmentOfChannel(0)).toBe('party');
  expect(s.chatRadio.channelOf('party')).toBe(0);
  expect(await s.clubChannel).toBe('already');
});
