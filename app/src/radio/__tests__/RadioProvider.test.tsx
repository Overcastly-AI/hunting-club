import { CheckInMode } from '@huntclub/mesh';
import { FakeAir, FakeRadio, seededRandom } from '@huntclub/mesh/testing';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { useContext, useEffect } from 'react';

import {
  ChatRadioContext,
  connectChat,
  nameOf,
  sendChat,
  type ChatRadio,
} from '../../chat/ChatRadio';
import { createChatStore, groupConversation } from '../../chat/model';
import { deliveryText } from '../../chat/wording';
import { CheckInRadioContext, type CheckInRadio } from '../../checkin/CheckInRadio';
import { createMapDataStore } from '../../map/dataSource';
import { SafetyRadioContext, type SafetyRadio } from '../../safety/SafetyRadio';
import { helpProgress } from '../../safety/wording';
import { backgroundSpy, memoryStore, RADIO_A, RADIO_B } from '../../test-utils/radioFixtures';
import { radioCopy } from '../copy';
import { RadioProvider, useRadio } from '../RadioProvider';
import { RadioStatus } from '../ui/RadioStatus';

const REMEMBERED = { peripheralId: 'AA:BB:CC:DD:EE:FF', name: 'Meshtastic 3c4d', pairedAt: 1 };

type Contexts = {
  checkIn: CheckInRadio | null;
  safety: SafetyRadio | null;
  chat: ChatRadio | null;
};

/** Captures what the screens would get from the provider. */
function Probe({ onChange }: { onChange: (contexts: Contexts) => void }) {
  const checkIn = useContext(CheckInRadioContext);
  const safety = useContext(SafetyRadioContext);
  const chat = useContext(ChatRadioContext);
  useEffect(() => {
    onChange({ checkIn, safety, chat });
  }, [onChange, checkIn, safety, chat]);
  return null;
}

async function renderPhone(radio: FakeRadio, seed: number, store = memoryStore(REMEMBERED)) {
  const background = backgroundSpy();
  const contexts: Contexts = { checkIn: null, safety: null, chat: null };
  const mapStore = createMapDataStore();
  const view = await render(
    <RadioProvider
      store={store}
      background={background}
      createTransport={() => radio}
      clientOptions={{ random: seededRandom(seed), pacingMs: 0 }}
      services={{ receipts: { jitterMs: 0 } }}
      mapStore={mapStore}
    >
      <RadioStatus />
      <Probe onChange={(next) => Object.assign(contexts, next)} />
    </RadioProvider>,
  );
  return { background, contexts, mapStore, view };
}

describe('RadioProvider', () => {
  it('reconnects to the remembered radio and shows its status', async () => {
    const { background } = await renderPhone(new FakeRadio(RADIO_A), 1);

    expect(await screen.findByText(radioCopy.link.ready)).toBeTruthy();
    expect(screen.getByText(RADIO_A.longName)).toBeTruthy();
    expect(background.running).toBe(true);
  });

  it('gives the screens no radio when none is remembered', async () => {
    const { contexts } = await renderPhone(new FakeRadio(RADIO_A), 1, memoryStore(null));

    expect(await screen.findByText(radioCopy.link.none)).toBeTruthy();
    expect(contexts).toEqual({ checkIn: null, safety: null, chat: null });
  });

  it('refuses to be used outside the provider', () => {
    function Orphan() {
      useRadio();
      return null;
    }
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    return expect(render(<Orphan />)).rejects.toThrow(/inside <RadioProvider>/);
  });
});

describe('two phones on one mesh (FakeAir)', () => {
  it('shows a check-in on the other map, gets "Seen by" for Ask for a Hand and delivers chat', async () => {
    const a = new FakeRadio(RADIO_A);
    const b = new FakeRadio(RADIO_B);
    new FakeAir().attach(a, b);
    const phoneA = await renderPhone(a, 1);
    const phoneB = await renderPhone(b, 2);
    await waitFor(() => {
      expect(phoneA.contexts.checkIn && phoneB.contexts.checkIn).toBeTruthy();
      expect(phoneA.contexts.chat?.client.myNodeNum).toBe(RADIO_A.nodeNum);
      expect(phoneB.contexts.chat?.client.myNodeNum).toBe(RADIO_B.nodeNum);
    });

    // 1. Phone A checks in On the move; phone B's map shows it, never phone A's own map.
    const pin = { lat: 40.79, lon: -77.86 };
    await act(async () => {
      phoneA.contexts.checkIn!.checkIns.checkIn({ mode: CheckInMode.Moving, pin });
    });
    await waitFor(() =>
      expect(phoneB.mapStore.getSnapshot().hunters).toEqual([
        expect.objectContaining({
          id: String(RADIO_A.nodeNum),
          place: { kind: 'moving' },
          position: pin,
        }),
      ]),
    );
    expect(phoneA.mapStore.getSnapshot().hunters).toEqual([]);

    // 2. Ask for a Hand: phone B's receipt turns it into "Seen by Sam radio".
    const safetyA = phoneA.contexts.safety!;
    await act(async () => {
      safetyA.help.ask();
    });
    await waitFor(() => {
      const state = safetyA.help.current!;
      const nameOfA = (node: number) => nameOf(phoneA.contexts.chat!, node);
      expect(helpProgress(state, nameOfA, 'party').title).toBe(`Seen by ${RADIO_B.longName}`);
    });

    // 3. Chat to the party: "Delivered to 1 of 1" once phone B's receipt comes back.
    const chatStore = createChatStore();
    const stopChat = connectChat(phoneA.contexts.chat!, chatStore); // what ChatConnector does in the app
    await act(async () => {
      sendChat(phoneA.contexts.chat!, chatStore, groupConversation('party'), 'Seeing deer');
    });
    await waitFor(() => {
      const [sent] = chatStore.getSnapshot();
      expect(sent?.kind === 'text' && deliveryText(sent)).toBe('Delivered to 1 of 1');
    });

    stopChat();
    phoneA.view.unmount();
    phoneB.view.unmount();
  });
});
