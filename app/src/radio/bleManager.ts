import BleManager from 'react-native-ble-manager';

/**
 * iOS state-restoration key: lets iOS relaunch the app in the background and
 * hand back the radio connection (CBCentralManagerOptionRestoreIdentifierKey).
 * Ignored on Android.
 */
export const BLE_RESTORE_IDENTIFIER = 'huntclub-radio-link';

let started: Promise<void> | undefined;

/** Starts react-native-ble-manager once per app run. Safe to call often. */
export function ensureBleStarted(): Promise<void> {
  started ??= BleManager.start({
    restoreIdentifierKey: BLE_RESTORE_IDENTIFIER,
    showAlert: false,
  }).catch((error: unknown) => {
    started = undefined;
    throw error;
  });
  return started;
}

/** For tests only. */
export function resetBleStartedForTests(): void {
  started = undefined;
}

/** Case-insensitive UUID match; platforms report UUIDs in different cases. */
export function sameUuid(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
