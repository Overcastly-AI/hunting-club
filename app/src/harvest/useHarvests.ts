import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import { listHarvests, type LocalHarvest } from './harvests';

const listeners = new Set<() => void>();

/** Tell every harvest list to reload (after a save or share). */
export function harvestsChanged(): void {
  listeners.forEach((l) => l());
}

/** Our harvests from the local DB, newest first, kept fresh. */
export function useHarvests(): LocalHarvest[] {
  const db = useSQLiteContext();
  const [harvests, setHarvests] = useState<LocalHarvest[]>([]);
  const reload = useCallback(() => {
    void listHarvests(db).then(setHarvests);
  }, [db]);
  useEffect(() => {
    reload();
    listeners.add(reload);
    return () => {
      listeners.delete(reload);
    };
  }, [reload]);
  return harvests;
}
