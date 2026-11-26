import * as SecureStore from 'expo-secure-store';

import { SECURE_KEYS, secureStorage } from '../secure';

jest.mock('expo-secure-store', () => {
  const items = new Map<string, string>();
  return {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'afterFirstUnlockThisDeviceOnly',
    getItemAsync: jest.fn(async (k: string) => items.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void items.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void items.delete(k)),
  };
});

it('stores, reads and deletes a secret on this device only, readable after first unlock', async () => {
  await secureStorage.set(SECURE_KEYS.clubAuthTokens, 'v');
  expect(await secureStorage.get(SECURE_KEYS.clubAuthTokens)).toBe('v');
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith('club.authTokens', 'v', {
    keychainAccessible: 'afterFirstUnlockThisDeviceOnly',
  });
  await secureStorage.delete(SECURE_KEYS.clubAuthTokens);
  expect(await secureStorage.get(SECURE_KEYS.clubAuthTokens)).toBeNull();
});

it('uses keys expo-secure-store accepts (letters, digits, ".", "-", "_")', () => {
  for (const key of Object.values(SECURE_KEYS)) expect(key).toMatch(/^[\w.-]+$/);
});
