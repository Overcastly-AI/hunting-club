import { MESHTASTIC_BLE } from '@huntclub/mesh';
import { FakeRadio, seededRandom } from '@huntclub/mesh/testing';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { fakeBle, resetFakeBle } from '../../test-utils/fakeBleManager';
import { backgroundSpy, memoryStore, RADIO_A } from '../../test-utils/radioFixtures';
import { resetBleStartedForTests } from '../bleManager';
import { radioCopy } from '../copy';
import { RadioProvider } from '../RadioProvider';
import { PairRadioScreen } from '../ui/PairRadioScreen';

jest.mock(
  'react-native-ble-manager',
  () => jest.requireActual('../../test-utils/fakeBleManager').fakeBleManagerModule,
);

beforeEach(() => {
  resetFakeBle();
  resetBleStartedForTests();
});

async function renderScreen() {
  const store = memoryStore();
  const onDone = jest.fn();
  await render(
    <RadioProvider
      store={store}
      background={backgroundSpy()}
      createTransport={() => new FakeRadio(RADIO_A)}
      clientOptions={{ random: seededRandom(1), pacingMs: 0 }}
    >
      <PairRadioScreen onDone={onDone} />
    </RadioProvider>,
  );
  return { store, onDone };
}

describe('PairRadioScreen', () => {
  it('shows the pairing PIN helper and Forget and re-pair help before any scan', async () => {
    await renderScreen();
    expect(screen.getByText(radioCopy.pin.title)).toBeTruthy();
    expect(screen.getByText(MESHTASTIC_BLE.defaultFixedPin)).toBeTruthy();
    expect(screen.getByText(radioCopy.repair.title)).toBeTruthy();
  });

  it('finds radios by name and signal, connects with one tap and remembers the radio', async () => {
    fakeBle.scanResults = [
      { id: 'FAR', rssi: -95, advertising: { localName: 'Far radio' } },
      { id: 'NEAR', rssi: -55, advertising: { localName: 'Near radio' } },
    ];
    const { store, onDone } = await renderScreen();

    await fireEvent.press(screen.getByRole('button', { name: radioCopy.pair.findRadios }));

    const near = await screen.findByRole('button', {
      name: `${radioCopy.pair.connect} Near radio, ${radioCopy.signal.strong}`,
    });
    expect(
      screen.getByRole('button', {
        name: `${radioCopy.pair.connect} Far radio, ${radioCopy.signal.weak}`,
      }),
    ).toBeTruthy();

    await fireEvent.press(near);

    expect(await screen.findByText(radioCopy.link.ready)).toBeTruthy();
    expect(store.value).toEqual(
      expect.objectContaining({ peripheralId: 'NEAR', name: 'Near radio' }),
    );

    await fireEvent.press(screen.getByRole('button', { name: radioCopy.pair.done }));
    expect(onDone).toHaveBeenCalled();
  });

  it('says so when no radios are found', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: radioCopy.pair.findRadios }));
    // The scan times out with nothing heard.
    await act(() => fakeBle.stopScanEvent.emit({}));
    expect(await screen.findByText(radioCopy.pair.noneFound)).toBeTruthy();
  });
});
