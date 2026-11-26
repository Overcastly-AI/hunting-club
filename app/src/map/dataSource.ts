import { useEffect, useState, useSyncExternalStore } from 'react';

import type { MapData } from './types';

/**
 * Where the map gets hunters, open stands and mesh status. The map only reads
 * this; a later milestone feeds it from the radio (`@huntclub/mesh` positions
 * and check-ins).
 */
export interface MapDataSource {
  getSnapshot(): MapData;
  subscribe(listener: () => void): () => void;
}

export const EMPTY_MAP_DATA: MapData = {
  hunters: [],
  openStands: [],
  mesh: { radioConnected: false, radioCount: 0, lastHeardAt: null },
};

/** A simple in-memory source that a feeder (radio, tests) can push snapshots into. */
export function createMapDataStore(initial: MapData = EMPTY_MAP_DATA): MapDataSource & {
  set(data: MapData): void;
} {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(data) {
      snapshot = data;
      listeners.forEach((listener) => listener());
    },
  };
}

/** The app's map data. Empty until the radio milestone feeds it. */
export const mapDataStore = createMapDataStore();

export function useMapData(source: MapDataSource = mapDataStore): MapData {
  return useSyncExternalStore(source.subscribe, source.getSnapshot);
}

/** The current time, refreshed on an interval so ages ("2 min ago") and freshness rings stay true. */
export function useNow(intervalMs = 10_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
