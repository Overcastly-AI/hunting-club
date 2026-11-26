/**
 * Every tunable in @huntclub/core, in one place, so the field test can
 * adjust airtime and safety timing without hunting through modules.
 * Services take partial overrides of their section.
 *
 * Fixed product rules (the 3-person free-party cap) are not tunables and
 * live with their logic (party.ts).
 */
/** Time units in ms: the only definitions in the repo. */
export const SECOND_MS = 1000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export interface CoreConfig {
  receipts: {
    /** Receipts a single sender can trigger in a burst. */
    burst: number;
    /** One more receipt per sender is allowed every this many ms. */
    refillMs: number;
    /** A repeat of the same message (a sender retry) is answered again at most this often. */
    repeatMinMs: number;
    /** Random delay before sending, so phones that heard the same message don't collide. */
    jitterMs: number;
  };
  help: {
    /** Delay before the first Ask for a Hand retry. */
    initialMs: number;
    /** Multiplier per retry. */
    factor: number;
    /** Longest delay between retries. */
    maxMs: number;
    /** ± fraction of random jitter on each delay. */
    jitter: number;
  };
  overdue: {
    /** Overdue = sunset + this (club admins can change it). */
    graceMinutes: number;
    /** At our own deadline we prompt first; with no answer for this long, the alert goes out. */
    selfPromptMinutes: number;
    /** "Still out? Extend N min." */
    extendMinutes: number;
    /**
     * Other phones wait this long past someone's deadline before alerting.
     * A little longer than selfPromptMinutes, so that hunter's own phone
     * (prompt, extend or alert) speaks first.
     */
    othersDelayMinutes: number;
    /** Extra random delay so one phone speaks for the party. */
    alertJitterMs: number;
    /** How often open check-ins are evaluated. */
    checkIntervalMs: number;
  };
  checkIn: {
    /** A member's CheckIn this soon after their previous one is a mode change in the same outing. */
    sameOutingMs: number;
  };
  party: {
    /** After joining, listen this long for the other members' node info before deciding the party is full. */
    discoveryMs: number;
    /** Save a member's last-heard time at most this often (writes to the store). */
    lastHeardSaveMs: number;
  };
}

export const CORE_CONFIG: Readonly<CoreConfig> = {
  receipts: { burst: 3, refillMs: 20_000, repeatMinMs: MINUTE_MS, jitterMs: 3_000 },
  help: { initialMs: 20_000, factor: 2, maxMs: 5 * MINUTE_MS, jitter: 0.2 },
  overdue: {
    graceMinutes: 30,
    selfPromptMinutes: 10,
    extendMinutes: 30,
    othersDelayMinutes: 12,
    alertJitterMs: MINUTE_MS,
    checkIntervalMs: MINUTE_MS,
  },
  checkIn: { sameOutingMs: 16 * HOUR_MS },
  party: { discoveryMs: 30_000, lastHeardSaveMs: 5 * MINUTE_MS },
};
