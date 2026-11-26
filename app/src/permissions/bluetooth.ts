import { PermissionsAndroid, Platform, type Permission } from 'react-native';
import BleManager, { BleState } from 'react-native-ble-manager';

import { ensureBleStarted } from '../radio/bleManager';
import { askPermission, type PermissionCopy } from './askPermission';

/**
 * The one place the app asks for Bluetooth (to pair and talk to the radio).
 *
 * - Android 12+ (API 31+): Nearby devices (BLUETOOTH_SCAN, declared
 *   neverForLocation, and BLUETOOTH_CONNECT).
 * - Android 11 and older: fine location, which old Android needs for any
 *   Bluetooth scan.
 * - Android 13+: notifications, for the "Connected to your radio" notice.
 *   Optional: the link works without it.
 * - iOS: iOS shows its prompt (NSBluetoothAlwaysUsageDescription in
 *   app.config.ts) the first time Bluetooth starts; afterwards only Settings
 *   can change it.
 */
export const BLUETOOTH_PERMISSION_COPY: PermissionCopy = {
  askTitle: 'Connect to your radio?',
  askBody:
    'Hunt Club uses Bluetooth to find your radio and talk to it, so you can text your party with no cell service. It does not use Bluetooth to find your location. Android may call this “Nearby devices”; older Android phones also ask for location.',
  deniedTitle: 'Bluetooth is off for Hunt Club',
  deniedBody:
    'To pair your radio, allow Bluetooth (Android: Nearby devices) for Hunt Club in your phone’s Settings.',
};

export type BluetoothReadiness = 'granted' | 'denied' | 'bluetoothOff';

/** Android API level where BLUETOOTH_SCAN / BLUETOOTH_CONNECT replaced location. */
const ANDROID_NEARBY_DEVICES_API = 31;
const ANDROID_NOTIFICATIONS_API = 33;

type AndroidRequest = { permission: Permission; required: boolean };

export function androidBluetoothPermissions(apiLevel: number): AndroidRequest[] {
  const P = PermissionsAndroid.PERMISSIONS;
  const requests: AndroidRequest[] =
    apiLevel >= ANDROID_NEARBY_DEVICES_API
      ? [
          { permission: P.BLUETOOTH_SCAN, required: true },
          { permission: P.BLUETOOTH_CONNECT, required: true },
        ]
      : [{ permission: P.ACCESS_FINE_LOCATION, required: true }];
  if (apiLevel >= ANDROID_NOTIFICATIONS_API) {
    requests.push({ permission: P.POST_NOTIFICATIONS, required: false });
  }
  return requests;
}

const androidApiLevel = () => Number(Platform.Version);

async function androidGranted(): Promise<boolean> {
  for (const { permission, required } of androidBluetoothPermissions(androidApiLevel())) {
    if (required && !(await PermissionsAndroid.check(permission))) return false;
  }
  return true;
}

async function androidRequest(): Promise<boolean> {
  const results = await PermissionsAndroid.requestMultiple(
    androidBluetoothPermissions(androidApiLevel()).map((r) => r.permission),
  );
  return androidBluetoothPermissions(androidApiLevel()).every(
    (r) => !r.required || results[r.permission] === PermissionsAndroid.RESULTS.GRANTED,
  );
}

/** Starting Bluetooth shows the iOS prompt the first time; Unauthorized means refused. */
async function iosRequest(): Promise<boolean> {
  await ensureBleStarted();
  return (await BleManager.checkState()) !== BleState.Unauthorized;
}

let grantedThisSession = false;

/**
 * Explains why, asks the system, offers Settings on refusal, then checks
 * Bluetooth itself is switched on.
 */
export async function ensureBluetoothPermission(): Promise<BluetoothReadiness> {
  if (!grantedThisSession) {
    const granted = await askPermission({
      copy: BLUETOOTH_PERMISSION_COPY,
      isGranted: Platform.OS === 'android' ? androidGranted : undefined,
      request: Platform.OS === 'android' ? androidRequest : iosRequest,
    });
    if (!granted) return 'denied';
    grantedThisSession = true;
  }
  await ensureBleStarted();
  return (await BleManager.checkState()) === BleState.Off ? 'bluetoothOff' : 'granted';
}

/** For tests only. */
export function resetBluetoothPermissionForTests(): void {
  grantedThisSession = false;
}
