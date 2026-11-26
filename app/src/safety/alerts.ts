import { HOUR_MS } from '@huntclub/core';
import type { LatLon } from '@huntclub/mesh';

import type { HunterPlace } from '../map/types';

/** Someone else asked for a hand, or someone is overdue. Never styled or worded like an emergency call. */
export type IncomingAlert = {
  kind: 'help' | 'overdue';
  /** One alert per request: "help:<node>:<message id>" or "overdue:<node>:<check-in id>". */
  key: string;
  node: number;
  name: string;
  /** When we heard it (ms). */
  heardAt: number;
  pin?: LatLon;
  place?: HunterPlace;
  note?: string;
  /** The full-screen alert was answered or closed; the map pin stays until it expires. */
  seen: boolean;
};

/** How long a help or overdue pin stays on the map after it was last heard. */
export const ALERT_PIN_TTL_MS = HOUR_MS;

export type AlertStore = {
  getSnapshot(): readonly IncomingAlert[];
  subscribe(listener: () => void): () => void;
  /** Adds an alert; a repeat of the same key keeps its `seen` state and updates the rest. */
  add(alert: Omit<IncomingAlert, 'seen'>): void;
  markSeen(key: string): void;
  /** Drops alerts older than the pin lifetime. */
  expire(now: number): void;
};

export function createAlertStore(): AlertStore {
  let alerts: readonly IncomingAlert[] = [];
  const listeners = new Set<() => void>();
  const set = (next: readonly IncomingAlert[]) => {
    alerts = next;
    listeners.forEach((l) => l());
  };
  return {
    getSnapshot: () => alerts,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    add(alert) {
      const existing = alerts.find((a) => a.key === alert.key);
      const next = { ...alert, seen: existing?.seen ?? false };
      set(existing ? alerts.map((a) => (a.key === alert.key ? next : a)) : [...alerts, next]);
    },
    markSeen(key) {
      set(alerts.map((a) => (a.key === key ? { ...a, seen: true } : a)));
    },
    expire(now) {
      const kept = alerts.filter((a) => now - a.heardAt < ALERT_PIN_TTL_MS);
      if (kept.length !== alerts.length) set(kept);
    },
  };
}

/** The alert to show full screen: the oldest one not yet answered. */
export function nextUnseen(alerts: readonly IncomingAlert[]): IncomingAlert | undefined {
  return alerts.find((a) => !a.seen);
}
