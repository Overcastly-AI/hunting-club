import type { SecureKey, SecureStorage } from '../storage/secure';

/** In-memory SecureStorage for tests; `values` shows what was stored. */
export function memorySecureStorage(): SecureStorage & { values: Map<SecureKey, string> } {
  const values = new Map<SecureKey, string>();
  return {
    values,
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => void values.set(key, value),
    delete: async (key) => void values.delete(key),
  };
}
