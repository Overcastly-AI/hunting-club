import { useSyncExternalStore } from 'react';

import type { MapData } from './types';

/**
 * Where the map gets hunters, open stands and mesh status. The map only reads
 * this; `connectMapData` (meshMapData.ts) feeds it from the radio's
 * MeshClient and CheckInBoard.
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

/** The app's map data. Empty until the radio is connected to it with `connectMapData`. */
export const mapDataStore = createMapDataStore();

export function useMapData(source: MapDataSource = mapDataStore): MapData {
  return useSyncExternalStore(source.subscribe, source.getSnapshot);
}
