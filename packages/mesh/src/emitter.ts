import type { Unsubscribe } from './transport';

/** Minimal typed event emitter (no Node `events` dependency, RN-safe). */
export class Emitter<Events extends { [K in keyof Events]: unknown }> {
  private listeners: { [K in keyof Events]?: Set<(payload: Events[K]) => void> } = {};

  on<K extends keyof Events>(event: K, cb: (payload: Events[K]) => void): Unsubscribe {
    let set = this.listeners[event];
    if (!set) {
      set = new Set();
      this.listeners[event] = set;
    }
    set.add(cb);
    return () => {
      set.delete(cb);
    };
  }

  once<K extends keyof Events>(event: K, cb: (payload: Events[K]) => void): Unsubscribe {
    const off = this.on(event, (p) => {
      off();
      cb(p);
    });
    return off;
  }

  protected emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners[event];
    if (!set) return;
    for (const cb of [...set]) {
      try {
        cb(payload);
      } catch {
        // A faulty listener must not break the radio link.
      }
    }
  }
}
