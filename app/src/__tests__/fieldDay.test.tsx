/**
 * Field day, end to end: three phones, plus a fourth that tries to join,
 * each running the app's whole radio stack (RadioProvider → RadioServices →
 * core → MeshClient) over one simulated LoRa mesh (FakeAir). The steps follow
 * docs/testing/field-test-plan.md, so a failure here names the scenario that
 * would fail in the woods.
 */
import { PartyFullError, type PartyService } from '@huntclub/core';
import { T0, fixedSun } from '@huntclub/core/testing';
import { CheckInMode, generatePartyChannelSet } from '@huntclub/mesh';
import { FakeAir, FakeRadio, seededRandom } from '@huntclub/mesh/testing';
import { act } from '@testing-library/react-native';
import { useContext, useEffect } from 'react';

import { ChatRadioContext, connectChat, nameOf, sendChat, type ChatRadio } from '../chat/ChatRadio';
import { createChatStore, groupConversation } from '../chat/model';
import { deliveryText } from '../chat/wording';
import { CheckInRadioContext, type CheckInRadio } from '../checkin/CheckInRadio';
import type { MyProfile } from '../db/appState';
import { createMapDataStore } from '../map/dataSource';
import { PartyRadioContext } from '../party/PartyRadio';
import { OwnerSync } from '../radio/OwnerSync';
import { connectSafetyAlerts, SafetyRadioContext, type SafetyRadio } from '../safety/SafetyRadio';
import { createAlertStore } from '../safety/alerts';
import { helpProgress } from '../safety/wording';
import { RADIO_A, RADIO_B, RADIO_C, RADIO_D } from '../test-utils/radioFixtures';
import { renderWithRadio } from '../test-utils/renderWithRadio';

type Contexts = {
  party: PartyService | null;
  checkIn: CheckInRadio | null;
  safety: SafetyRadio | null;
  chat: ChatRadio | null;
};

/** Captures what the screens get from the provider. */
function Probe({ into }: { into: Contexts }) {
  const party = useContext(PartyRadioContext);
  const checkIn = useContext(CheckInRadioContext);
  const safety = useContext(SafetyRadioContext);
  const chat = useContext(ChatRadioContext);
  useEffect(() => {
    Object.assign(into, { party, checkIn, safety, chat });
  }, [into, party, checkIn, safety, chat]);
  return null;
}

/** Lets simulated time pass (radio traffic, retries, sunset). */
const wait = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));

/** Starts an action and lets `ms` of simulated time pass in the same act(); returns its outcome. */
async function settle<T>(start: () => Promise<T>, ms: number): Promise<T> {
  let outcome!: Promise<T>;
  await act(async () => {
    outcome = start();
    outcome.catch(() => undefined); // the caller asserts on it
    await jest.advanceTimersByTimeAsync(ms);
  });
  return outcome;
}

/** Each phone's onboarding name. */
const NAMES: Record<string, MyProfile> = {
  jake: { displayName: 'Jake Smith', initials: 'JS' },
  sam: { displayName: 'Sam Lee', initials: 'SL' },
  cody: { displayName: 'Cody Hart', initials: 'CH' },
  dave: { displayName: 'Dave Ross', initials: 'DR' },
};

const DISCOVERY_MS = 2_000;
const PIN_A = { lat: 46.0, lon: -94.0 };
const PIN_B = { lat: 46.004, lon: -94.003 };

async function phone(air: FakeAir, fixture: typeof RADIO_A, profile: MyProfile, seed: number) {
  // A new radio is on its own private channel until it joins a party.
  const radio = new FakeRadio({
    ...fixture,
    channels: generatePartyChannelSet({ random: seededRandom(fixture.nodeNum), name: 'Solo' })
      .settings,
  });
  air.attach(radio);
  const contexts: Contexts = { party: null, checkIn: null, safety: null, chat: null };
  const mapStore = createMapDataStore();
  const remembered = { peripheralId: `radio-${seed}`, name: fixture.longName, pairedAt: T0 };
  const rendered = await renderWithRadio(
    <>
      <OwnerSync profile={profile} />
      <Probe into={contexts} />
    </>,
    {
      radio,
      remembered,
      seed,
      mapStore,
      services: {
        receipts: { jitterMs: 0 },
        partyConfig: { discoveryMs: DISCOVERY_MS },
        sun: fixedSun(), // sunset 23:00 UTC every day
      },
    },
  );
  const alerts = createAlertStore();
  return { ...rendered, radio, contexts, mapStore, alerts };
}

beforeEach(() => jest.useFakeTimers({ now: T0 }));
afterEach(() => jest.useRealTimers());

it('a party of three hunts a day: join, check in, ask for a hand, chat, overdue', async () => {
  const air = new FakeAir();
  const [a, b, c, d] = [
    await phone(air, RADIO_A, NAMES.jake!, 1),
    await phone(air, RADIO_B, NAMES.sam!, 2),
    await phone(air, RADIO_C, NAMES.cody!, 3),
    await phone(air, RADIO_D, NAMES.dave!, 4),
  ];
  await wait(1_000);
  const all = [a, b, c, d];
  for (const p of all) expect(p.contexts.party && p.contexts.chat).toBeTruthy();

  // Onboarding: each radio now carries its hunter's name.
  expect(all.map((p) => p.radio.user.longName)).toEqual(
    ['jake', 'sam', 'cody', 'dave'].map((k) => NAMES[k]!.displayName),
  );

  // 1. Jake starts a party; Sam and Cody scan his Party QR code.
  const party = (p: (typeof all)[number]) => p.contexts.party!;
  const join = (p: (typeof all)[number], link: string) =>
    settle(() => party(p).join(link), DISCOVERY_MS + 1_000);
  await settle(() => party(a).create(), 1_000);
  const link = party(a).qrLink()!;
  await join(b, link);
  await join(c, party(a).qrLink()!);
  await wait(1_000);
  for (const p of [a, b, c]) expect(party(p).current).toMatchObject({ size: 3, isFull: true });
  expect(party(a).qrLink()).toBeNull(); // the QR code is hidden once the party is full

  // 2. Dave, with a screenshot of the code from earlier, is refused.
  await expect(join(d, link)).rejects.toThrow(PartyFullError);
  expect(party(d).current).toBeNull();

  // Safety alerts and chat, as the app's connectors wire them.
  const stops = all.map((p) => connectSafetyAlerts(p.contexts.safety!, p.alerts));
  const chatA = createChatStore();
  stops.push(connectChat(a.contexts.chat!, chatA));

  // 3. Jake checks in at a spot, Sam on the move; each sees the others on the map.
  await act(async () => {
    a.contexts.checkIn!.checkIns.checkIn({ mode: CheckInMode.Spot, pin: PIN_A, name: 'Oak ridge' });
    b.contexts.checkIn!.checkIns.checkIn({ mode: CheckInMode.Moving, pin: PIN_B });
  });
  await wait(5_000);
  const huntersOn = (p: (typeof all)[number]) =>
    p.mapStore
      .getSnapshot()
      .hunters.map((h) => ({ id: Number(h.id), kind: h.place.kind }))
      .sort((x, y) => x.id - y.id);
  const jake = { id: RADIO_A.nodeNum, kind: 'spot' };
  const sam = { id: RADIO_B.nodeNum, kind: 'moving' };
  expect(huntersOn(c)).toEqual([jake, sam].sort((x, y) => x.id - y.id));
  expect(huntersOn(a)).toEqual([sam]);
  expect(huntersOn(b)).toEqual([jake]);
  expect(huntersOn(d)).toEqual([]); // not in the party: hears nothing

  // 4. Cody asks for a hand: Jake and Sam are alerted, and Cody sees "Seen by" both.
  await act(async () => {
    c.contexts.safety!.help.ask();
  });
  await wait(10_000);
  for (const p of [a, b]) {
    expect(p.alerts.getSnapshot()).toEqual([
      expect.objectContaining({ kind: 'help', node: RADIO_C.nodeNum, name: 'Cody Hart' }),
    ]);
  }
  expect(d.alerts.getSnapshot()).toEqual([]);
  const helpState = c.contexts.safety!.help.current!;
  const nameOnC = (node: number) => nameOf(c.contexts.chat!, node);
  expect(helpProgress(helpState, nameOnC, 'party').title).toMatch(
    /^Seen by (Jake Smith and Sam Lee|Sam Lee and Jake Smith)$/,
  );
  await act(async () => {
    c.contexts.safety!.help.cancel();
  });

  // 5. Jake texts the party: delivered to both others.
  await act(async () => {
    sendChat(a.contexts.chat!, chatA, groupConversation('party'), 'Buck heading your way');
  });
  await wait(10_000);
  const sent = chatA.getSnapshot().find((item) => item.kind === 'text' && item.mine);
  expect(sent?.kind === 'text' && deliveryText(sent)).toBe('Delivered to 2 of 2');

  // 6. Sunset 23:00 + 30 min grace: Jake's own phone asks first ("Still out?"),
  //    then, with no answer, his party is alerted. Sam (also checked in) too.
  const prompts: number[] = [];
  stops.push(a.contexts.safety!.overdue.on('selfPrompt', (e) => prompts.push(e.overdueAt)));
  const deadline = Date.UTC(2026, 10, 26, 23, 30);
  await wait(deadline - Date.now() + 60_000);
  expect(prompts).toEqual([deadline]);
  expect(c.alerts.getSnapshot().filter((x) => x.kind === 'overdue')).toEqual([]);

  await wait(15 * 60_000); // past the self-prompt window and the others' wait
  const overdueOn = (p: (typeof all)[number]) =>
    p.alerts
      .getSnapshot()
      .filter((x) => x.kind === 'overdue')
      .map((x) => x.node)
      .sort();
  expect(overdueOn(c)).toEqual([RADIO_A.nodeNum, RADIO_B.nodeNum].sort());
  expect(overdueOn(a)).toEqual([RADIO_B.nodeNum]);
  expect(overdueOn(b)).toEqual([RADIO_A.nodeNum]);
  expect(overdueOn(d)).toEqual([]);

  stops.forEach((stop) => stop());
  for (const p of all) await p.view.unmount();
});
