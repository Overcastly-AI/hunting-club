import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import { listMapPacks, type MapPack } from './mapPacks';
import {
  deleteDownload,
  resumeDownloads,
  startDownload,
  type DownloadProgress,
  type DownloadRequest,
} from './offline';

/** Downloaded areas from the local DB, plus live progress for running downloads. */
export function useMapPacks() {
  const db = useSQLiteContext();
  const [packs, setPacks] = useState<MapPack[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => setPacks(await listMapPacks(db)), [db]);

  const onProgress = useCallback(
    (update: DownloadProgress) => {
      setProgress((current) => ({ ...current, [update.packId]: update.percentage }));
      if (update.done) void refresh();
    },
    [refresh],
  );

  useEffect(() => {
    void resumeDownloads(db, onProgress).then(refresh);
  }, [db, onProgress, refresh]);

  const start = useCallback(
    async (request: DownloadRequest) => {
      await startDownload(db, request, onProgress);
      await refresh();
    },
    [db, onProgress, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteDownload(db, id);
      await refresh();
    },
    [db, refresh],
  );

  return { packs, progress, start, remove };
}
