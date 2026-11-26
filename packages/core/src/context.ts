import {
  defaultRandom,
  defaultTimers,
  type MeshClient,
  type RandomSource,
  type Timers,
} from '@huntclub/mesh';

/** What every core service needs. Clock, timers and randomness are injectable for tests. */
export interface CoreContext {
  client: MeshClient;
  random?: RandomSource;
  timers?: Timers;
  /** Milliseconds since the epoch. Prefer GPS or radio time when the app has it. */
  now?: () => number;
}

export interface ResolvedContext {
  client: MeshClient;
  random: RandomSource;
  timers: Timers;
  now: () => number;
}

export function resolveContext(ctx: CoreContext): ResolvedContext {
  return {
    client: ctx.client,
    random: ctx.random ?? defaultRandom,
    timers: ctx.timers ?? defaultTimers,
    now: ctx.now ?? (() => Date.now()),
  };
}

/** Unix seconds for app-message timestamps. */
export const unixSeconds = (ms: number): number => Math.floor(ms / 1000);

/** A uniform random number in [0, 1) from the injected random source. */
export const randomFraction = (random: RandomSource): number => {
  const b = random(4);
  return (((b[0]! << 24) | (b[1]! << 16) | (b[2]! << 8) | b[3]!) >>> 0) / 0x100000000;
};
