// Runtime globals this package relies on. They exist in Node 22 and in
// React Native's Hermes (RN >= 0.74). Typed locally instead of pulling in
// the DOM or Node libs, so nothing platform-specific creeps into the package
// and no global declarations clash with the app's own types.

interface Utf8Encoder {
  encode(input: string): Uint8Array;
}
interface Utf8Decoder {
  decode(input: Uint8Array): string;
}
interface RuntimeGlobals {
  TextEncoder: new () => Utf8Encoder;
  TextDecoder: new (label?: string, options?: { fatal?: boolean }) => Utf8Decoder;
  setTimeout(cb: () => void, ms?: number): unknown;
  clearTimeout(handle: unknown): void;
}

const g = globalThis as unknown as RuntimeGlobals;

let encoder: Utf8Encoder | undefined;
let decoder: Utf8Decoder | undefined;

export const encodeUtf8 = (s: string): Uint8Array => (encoder ??= new g.TextEncoder()).encode(s);
export const decodeUtf8 = (b: Uint8Array): string =>
  (decoder ??= new g.TextDecoder('utf-8', { fatal: false })).decode(b);

export type TimerHandle = unknown;

/** Timer functions, injectable so tests can drive time deterministically. */
export interface Timers {
  setTimeout(cb: () => void, ms: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}

// Look the globals up on every call so Jest fake timers are honoured.
export const defaultTimers: Timers = {
  setTimeout: (cb, ms) => g.setTimeout(cb, ms),
  clearTimeout: (h) => g.clearTimeout(h),
};
