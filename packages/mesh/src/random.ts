/** Source of cryptographically secure random bytes. The app injects one
 * backed by expo-crypto; tests inject a deterministic one. */
export type RandomSource = (length: number) => Uint8Array;

/** Uses `globalThis.crypto.getRandomValues` (Node 19+, browsers, or a
 * polyfilled React Native runtime). Throws if none is available. */
export const defaultRandom: RandomSource = (length) => {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (!c?.getRandomValues) {
    throw new Error('No secure random source available; pass `random` explicitly');
  }
  return c.getRandomValues(new Uint8Array(length));
};

/** A random uint32 that is never 0. */
export function randomUint32(random: RandomSource): number {
  for (;;) {
    const b = random(4);
    const v = ((b[0]! << 24) | (b[1]! << 16) | (b[2]! << 8) | b[3]!) >>> 0;
    if (v !== 0) return v;
  }
}
