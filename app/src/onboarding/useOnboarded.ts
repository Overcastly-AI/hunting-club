import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { loadOnboardedAt } from '../db/appState';

/** Whether this phone finished onboarding; undefined while loading. */
export function useOnboarded(): boolean | undefined {
  const db = useSQLiteContext();
  const [onboarded, setOnboarded] = useState<boolean>();
  useEffect(() => {
    let cancelled = false;
    void loadOnboardedAt(db).then((at) => {
      if (!cancelled) setOnboarded(at !== null);
    });
    return () => {
      cancelled = true;
    };
  }, [db]);
  return onboarded;
}
