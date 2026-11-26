import * as SecureStore from 'expo-secure-store';

import { deleteSecret, getSecret, setSecret } from '../secure';

jest.mock('expo-secure-store', () => {
  const items = new Map<string, string>();
  return {
    AFTER_FIRST_UNLOCK: 'afterFirstUnlock',
    getItemAsync: jest.fn(async (k: string) => items.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void items.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void items.delete(k)),
  };
});

it('stores, reads and deletes a secret, readable after first unlock', async () => {
  await setSecret('k', 'v');
  expect(await getSecret('k')).toBe('v');
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith('k', 'v', {
    keychainAccessible: 'afterFirstUnlock',
  });
  await deleteSecret('k');
  expect(await getSecret('k')).toBeNull();
});
