import * as SecureStore from 'expo-secure-store';

/**
 * Secrets the app keeps on the phone (iOS Keychain, Android Keystore): the
 * party join link, which holds the channel key, and club sign-in tokens.
 * The one place the app reads and writes secrets. Never log the values.
 */
export type SecureStorage = {
  get(key: SecureKey): Promise<string | null>;
  set(key: SecureKey, value: string): Promise<void>;
  delete(key: SecureKey): Promise<void>;
};

/** Every secret's key, in one place (letters, digits, ".", "-" and "_" only). */
export const SECURE_KEYS = {
  partyJoinLink: 'party.joinLink',
} as const;
export type SecureKey = (typeof SECURE_KEYS)[keyof typeof SECURE_KEYS];

/**
 * Readable after the first unlock since boot, so the radio link can restore
 * the party in the background; kept on this phone only (no iCloud backup).
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export const secureStorage: SecureStorage = {
  get: (key) => SecureStore.getItemAsync(key, OPTIONS),
  set: (key, value) => SecureStore.setItemAsync(key, value, OPTIONS),
  delete: (key) => SecureStore.deleteItemAsync(key, OPTIONS),
};
