import type { RandomSource } from '../random';

/** Deterministic RandomSource for tests (xorshift32). Never use for real keys. */
export function seededRandom(seed = 0x2545f491): RandomSource {
  let x = seed >>> 0 || 1;
  return (length) => {
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      x ^= x << 13;
      x >>>= 0;
      x ^= x >>> 17;
      x ^= x << 5;
      x >>>= 0;
      out[i] = x & 0xff;
    }
    return out;
  };
}
