import { PermissionsAndroid } from 'react-native';

import { androidRadioPermissions } from '../permissions';

jest.mock(
  'react-native-ble-manager',
  () => jest.requireActual('../../test-utils/fakeBleManager').fakeBleManagerModule,
);

const P = PermissionsAndroid.PERMISSIONS;
const names = (api: number) => androidRadioPermissions(api).map((r) => r.permission);

describe('androidRadioPermissions', () => {
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

  it('gives every request a plain-language reason and treats notifications as optional', () => {
    for (const r of androidRadioPermissions(34)) {
      expect(r.message.length).toBeGreaterThan(20);
      expect(r.required).toBe(r.permission !== P.POST_NOTIFICATIONS);
    }
  });
});
