import { MESHTASTIC_BLE } from '@huntclub/mesh';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { fakeBle } from '../../test-utils/fakeBleManager';
import { renderWithRadio } from '../../test-utils/renderWithRadio';
import { resetBluetoothForTests } from '../../test-utils/resetBluetooth';
import { radioCopy } from '../copy';
import { PairRadioScreen } from '../ui/PairRadioScreen';

jest.mock(
  'react-native-ble-manager',
  () => jest.requireActual('../../test-utils/fakeBleManager').fakeBleManagerModule,
);

beforeEach(resetBluetoothForTests);

async function renderScreen() {
  const onDone = jest.fn();
  const { store } = await renderWithRadio(<PairRadioScreen onDone={onDone} />);
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
