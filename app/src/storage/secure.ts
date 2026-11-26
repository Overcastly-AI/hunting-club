import * as SecureStore from 'expo-secure-store';

/**
 * Secrets on this phone (club sign-in tokens, the party join link): the iOS Keychain /
 * Android Keystore, readable once the phone has been unlocked after boot. The one place
 * the app uses expo-secure-store. Never log the values.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export function getSecret(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key, OPTIONS);
}

export function setSecret(key: string, value: string): Promise<void> {
  return SecureStore.setItemAsync(key, value, OPTIONS);
}

export function deleteSecret(key: string): Promise<void> {
  return SecureStore.deleteItemAsync(key, OPTIONS);
}
