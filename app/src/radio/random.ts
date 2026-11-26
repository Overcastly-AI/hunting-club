import type { RandomSource } from '@huntclub/mesh';
import { getRandomBytes } from 'expo-crypto';

/**
 * Secure random bytes for MeshClient (packet ids, config nonces). React Native
 * has no `crypto.getRandomValues`, so the mesh package's default can't be used.
 */
export const randomBytes: RandomSource = (length) => getRandomBytes(length);
