import { PermissionsAndroid, Platform } from 'react-native';

import { answerAlerts } from '../../test-utils/alerts';
import { fakeBle, resetFakeBle } from '../../test-utils/fakeBleManager';
import { resetBleStartedForTests } from '../../radio/bleManager';
import { PERMISSION_BUTTONS } from '../askPermission';
import {
  androidBluetoothPermissions,
  BLUETOOTH_PERMISSION_COPY,
  ensureBluetoothPermission,
  resetBluetoothPermissionForTests,
} from '../bluetooth';

jest.mock(
  'react-native-ble-manager',
  () => jest.requireActual('../../test-utils/fakeBleManager').fakeBleManagerModule,
);

const P = PermissionsAndroid.PERMISSIONS;
const names = (api: number) => androidBluetoothPermissions(api).map((r) => r.permission);

beforeEach(() => {
  jest.restoreAllMocks();
  resetFakeBle();
  resetBleStartedForTests();
  resetBluetoothPermissionForTests();
});

describe('androidBluetoothPermissions', () => {
  it('asks for Nearby devices (scan + connect) and notifications on Android 13+', () => {
    expect(names(34)).toEqual([P.BLUETOOTH_SCAN, P.BLUETOOTH_CONNECT, P.POST_NOTIFICATIONS]);
  });

  it('asks for Nearby devices only on Android 12', () => {
    expect(names(31)).toEqual([P.BLUETOOTH_SCAN, P.BLUETOOTH_CONNECT]);
  });

  it('asks for location on Android 11 and older, never on newer phones', () => {
    expect(names(30)).toEqual([P.ACCESS_FINE_LOCATION]);
    expect(names(34)).not.toContain(P.ACCESS_FINE_LOCATION);
  });

  it('treats notifications as optional', () => {
    for (const r of androidBluetoothPermissions(34)) {
      expect(r.required).toBe(r.permission !== P.POST_NOTIFICATIONS);
    }
  });
});

describe('ensureBluetoothPermission (iOS)', () => {
  it('explains, then starts Bluetooth (the iOS prompt), and reports ready', async () => {
    const alerts = answerAlerts(PERMISSION_BUTTONS.continue);
    expect(Platform.OS).toBe('ios');

    await expect(ensureBluetoothPermission()).resolves.toBe('granted');

    expect(alerts).toHaveBeenCalledTimes(1);
    expect(fakeBle.calls).toContain('start');
  });

  it('does not start Bluetooth (and so no iOS prompt) after "Not now"', async () => {
    answerAlerts(PERMISSION_BUTTONS.notNow);
    await expect(ensureBluetoothPermission()).resolves.toBe('denied');
    expect(fakeBle.calls).not.toContain('start');
  });

  it('reports a refusal and offers Settings', async () => {
    const alerts = answerAlerts((title) =>
      title === BLUETOOTH_PERMISSION_COPY.askTitle
        ? PERMISSION_BUTTONS.continue
        : PERMISSION_BUTTONS.notNow,
    );
    fakeBle.state = 'unauthorized';
    await expect(ensureBluetoothPermission()).resolves.toBe('denied');
    expect(alerts.mock.calls.map((c) => c[0])).toEqual([
      BLUETOOTH_PERMISSION_COPY.askTitle,
      BLUETOOTH_PERMISSION_COPY.deniedTitle,
    ]);
  });

  it('reports when Bluetooth is switched off, and explains only once per session', async () => {
    const alerts = answerAlerts(PERMISSION_BUTTONS.continue);
    await ensureBluetoothPermission();
    fakeBle.state = 'off';
    await expect(ensureBluetoothPermission()).resolves.toBe('bluetoothOff');
    expect(alerts).toHaveBeenCalledTimes(1);
  });
});
