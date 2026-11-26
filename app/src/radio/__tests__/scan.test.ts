import { MESHTASTIC_BLE } from '@huntclub/mesh';
import { fakeBle, resetFakeBle } from '../../test-utils/fakeBleManager';
import { resetBleStartedForTests } from '../bleManager';
import { scanForRadios, toFoundRadio, type FoundRadio } from '../scan';
import { signalLabel, signalLevel } from '../signal';

jest.mock(
  'react-native-ble-manager',
  () => jest.requireActual('../../test-utils/fakeBleManager').fakeBleManagerModule,
);

beforeEach(() => {
  resetFakeBle();
  resetBleStartedForTests();
});

describe('scanForRadios', () => {
  it('scans only for the Meshtastic service and reports radios by name and signal', async () => {
    fakeBle.scanResults = [
      { id: 'A', rssi: -60, name: 'Meshtastic_1a2b', advertising: { localName: 'Hunter 1a2b' } },
      { id: 'B', rssi: -90, advertising: {} },
    ];
    const found: FoundRadio[] = [];
    const onDone = jest.fn();

    const stop = await scanForRadios({ onFound: (r) => found.push(r), onDone });

    expect(fakeBle.calls).toContain(`scan ${MESHTASTIC_BLE.serviceUuid}`);
    expect(found).toEqual([
      { id: 'A', name: 'Hunter 1a2b', rssi: -60 },
      { id: 'B', name: 'Meshtastic radio', rssi: -90 },
    ]);

    stop();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(fakeBle.discover.size).toBe(0);
  });

  it('falls back to the peripheral name', () => {
    expect(toFoundRadio({ id: 'C', rssi: -70, name: 'Heltec', advertising: {} }).name).toBe(
      'Heltec',
    );
  });
});

describe('signal labels', () => {
  it('uses words, not numbers', () => {
    expect(signalLevel(-55)).toBe('strong');
    expect(signalLevel(-80)).toBe('good');
    expect(signalLevel(-95)).toBe('weak');
    expect(signalLabel(-55)).toBe('Strong signal');
  });
});
