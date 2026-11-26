/**
 * Classifies Bluetooth failures from react-native-ble-manager into the few
 * cases the radio link reacts to. Platform status codes, from the Android
 * BluetoothGatt and iOS Core Bluetooth docs:
 *
 * - Android GATT status 133 (GATT_ERROR): generic, usually a timeout or a
 *   stale bond / GATT cache. Retry, refresh the cache, then suggest re-pairing.
 * - Android 5 / 15 / 137 and iOS CBATTError 5 / 15: insufficient
 *   authentication or encryption, i.e. the radio and phone disagree about the
 *   pairing. iOS CBError 14 (peerRemovedPairingInformation) is the same case.
 *   Only "Forget and re-pair" fixes it.
 */
export type BleFailure = 'gatt133' | 'auth' | 'other';

export const GATT_ERROR_133 = 133;
const ANDROID_AUTH_STATUSES = [5, 15, 137] as const;
const IOS_ATT_AUTH_CODES = [5, 15] as const;
const IOS_PEER_REMOVED_PAIRING = 14;

/** Disconnect event fields from react-native-ble-manager (status: Android; domain/code: iOS). */
export type BleDisconnectInfo = { status?: number; domain?: string; code?: number };

export function classifyDisconnect(info: BleDisconnectInfo): BleFailure {
  if (info.status === GATT_ERROR_133) return 'gatt133';
  if (info.status !== undefined && includes(ANDROID_AUTH_STATUSES, info.status)) return 'auth';
  if (info.code !== undefined && info.domain) {
    if (info.domain.includes('CBATTError') && includes(IOS_ATT_AUTH_CODES, info.code))
      return 'auth';
    if (info.domain.includes('CBError') && info.code === IOS_PEER_REMOVED_PAIRING) return 'auth';
  }
  return 'other';
}

/** Rejections from react-native-ble-manager are plain strings such as "Error reading … status=5". */
export function classifyError(error: unknown): BleFailure {
  const text = String(error instanceof Error ? error.message : error).toLowerCase();
  const status = /status[=:\s]+(\d+)/.exec(text);
  if (status?.[1]) return classifyDisconnect({ status: Number(status[1]) });
  if (/\b133\b/.test(text)) return 'gatt133';
  if (/authenticat|encrypt|pairing|bond/.test(text)) return 'auth';
  return 'other';
}

function includes(list: readonly number[], value: number): boolean {
  return list.includes(value);
}
