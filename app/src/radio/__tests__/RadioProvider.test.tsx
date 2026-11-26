import { MeshClient } from '@huntclub/mesh';
import { FakeAir, FakeRadio, seededRandom } from '@huntclub/mesh/testing';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { backgroundSpy, memoryStore, RADIO_A, RADIO_B } from '../../test-utils/radioFixtures';
import { radioCopy } from '../copy';
import { RadioProvider, useRadio } from '../RadioProvider';
import { RadioStatus } from '../ui/RadioStatus';
import { RadioTestPanel } from '../ui/RadioTestPanel';

const REMEMBERED = { peripheralId: 'AA:BB:CC:DD:EE:FF', name: 'Meshtastic 3c4d', pairedAt: 1 };

async function renderPhone(radio: FakeRadio, store = memoryStore(REMEMBERED)) {
  const background = backgroundSpy();
  await render(
    <RadioProvider
      store={store}
      background={background}
      createTransport={() => radio}
      clientOptions={{ random: seededRandom(1), pacingMs: 0 }}
    >
      <RadioStatus />
      <RadioTestPanel />
    </RadioProvider>,
  );
  return { background, store };
}

describe('RadioProvider', () => {
  it('reconnects to the remembered radio and shows its status', async () => {
    const { background } = await renderPhone(new FakeRadio(RADIO_A));

    expect(await screen.findByText(radioCopy.link.ready)).toBeTruthy();
    expect(screen.getByText(RADIO_A.longName)).toBeTruthy();
    expect(background.running).toBe(true);
  });

  it('shows no radio and disables sending when none is remembered', async () => {
    await renderPhone(new FakeRadio(RADIO_A), memoryStore(null));

    expect(await screen.findByText(radioCopy.link.none)).toBeTruthy();
    expect(screen.getByRole('button', { name: radioCopy.test.send })).toBeDisabled();
  });

  it('sends and receives texts through the Radio test panel', async () => {
    const a = new FakeRadio(RADIO_A);
    const b = new FakeRadio(RADIO_B);
    new FakeAir().attach(a, b);
    const other = new MeshClient({ transport: b, random: seededRandom(2), pacingMs: 0 });
    await other.connect();
    await other.waitUntilReady();

    await renderPhone(a);
    await screen.findByText(radioCopy.link.ready);

    await fireEvent.changeText(screen.getByLabelText(radioCopy.test.placeholder), 'Seeing deer');
    await fireEvent.press(screen.getByRole('button', { name: radioCopy.test.send }));

    expect(await screen.findByText('Seeing deer')).toBeTruthy();
    expect(
      await screen.findByText(
        new RegExp(`${radioCopy.test.status.heard}|${radioCopy.test.status.delivered}`),
      ),
    ).toBeTruthy();

    other.sendText('Coming to you');
    expect(await screen.findByText('Coming to you')).toBeTruthy();
    expect(screen.getByText(new RegExp(RADIO_B.longName))).toBeTruthy();

    await other.close();
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
