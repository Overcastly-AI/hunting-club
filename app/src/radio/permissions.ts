import { PermissionsAndroid, Platform, type Permission } from 'react-native';
import BleManager, { BleState } from 'react-native-ble-manager';

import { ensureBleStarted } from './bleManager';
import { radioCopy } from './copy';

/**
 * Runtime permissions for the radio link, each with a plain-language reason.
 *
 * - Android 12+ (API 31+): Nearby devices (BLUETOOTH_SCAN, declared
 *   neverForLocation, and BLUETOOTH_CONNECT).
 * - Android 11 and older: fine location, which old Android needs for any
 *   Bluetooth scan.
 * - Android 13+: notifications, for the "Connected to your radio" notice.
 *   Optional: the link works without it.
 * - iOS: no runtime call. iOS asks once, using NSBluetoothAlwaysUsageDescription,
 *   when Bluetooth first starts; afterwards only Settings can change it.
 */
export type RadioPermissionState =
  | { status: 'granted' }
  /** The user said no; asking again may work. */
  | { status: 'denied' }
  /** Only the system Settings app can change it now. */
  | { status: 'blocked' }
  | { status: 'bluetoothOff' };

/** Android API level where BLUETOOTH_SCAN / BLUETOOTH_CONNECT replaced location. */
const ANDROID_NEARBY_DEVICES_API = 31;
const ANDROID_NOTIFICATIONS_API = 33;

type AndroidRequest = { permission: Permission; message: string; required: boolean };

export function androidRadioPermissions(apiLevel: number): AndroidRequest[] {
  const P = PermissionsAndroid.PERMISSIONS;
  const requests: AndroidRequest[] =
    apiLevel >= ANDROID_NEARBY_DEVICES_API
      ? [
          {
            permission: P.BLUETOOTH_SCAN,
            message: radioCopy.permissions.nearbyDevices,
            required: true,
          },
          {
            permission: P.BLUETOOTH_CONNECT,
            message: radioCopy.permissions.nearbyDevices,
            required: true,
          },
        ]
      : [
          {
            permission: P.ACCESS_FINE_LOCATION,
            message: radioCopy.permissions.location,
            required: true,
          },
        ];
  if (apiLevel >= ANDROID_NOTIFICATIONS_API) {
    requests.push({
      permission: P.POST_NOTIFICATIONS,
      message: radioCopy.permissions.notifications,
      required: false,
    });
  }
  return requests;
}

async function requestAndroid(apiLevel: number): Promise<RadioPermissionState> {
  let worst: RadioPermissionState = { status: 'granted' };
  for (const { permission, message, required } of androidRadioPermissions(apiLevel)) {
    if (await PermissionsAndroid.check(permission)) continue;
    const result = await PermissionsAndroid.request(permission, {
      title: radioCopy.permissions.title,
      message,
      buttonPositive: radioCopy.permissions.allow,
      buttonNegative: radioCopy.permissions.notNow,
    });
    if (!required || result === PermissionsAndroid.RESULTS.GRANTED) continue;
    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return { status: 'blocked' };
    worst = { status: 'denied' };
  }
  return worst;
}

async function bluetoothState(): Promise<RadioPermissionState> {
  await ensureBleStarted();
  const state = await BleManager.checkState();
  if (state === BleState.Unauthorized) return { status: 'blocked' };
  if (state === BleState.Off) return { status: 'bluetoothOff' };
  return { status: 'granted' };
}

/** Asks for whatever the radio link still needs, then checks Bluetooth is on. */
export async function requestRadioPermissions(): Promise<RadioPermissionState> {
  if (Platform.OS === 'android') {
    const result = await requestAndroid(Number(Platform.Version));
    if (result.status !== 'granted') return result;
  }
  return bluetoothState();
}
