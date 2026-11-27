import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  loadNameSkippedAt,
  loadProfile,
  markNameSkipped,
  saveProfile,
  type MyProfile,
} from '../db/appState';
import type { SqlDatabase } from '../db/types';

export type ProfileContextValue = {
  /** undefined while loading; null before the hunter enters a name. */
  profile: MyProfile | null | undefined;
  save: (profile: MyProfile) => Promise<void>;
  /** The hunter chose "Skip for now" at check-in: the name prompt isn't shown there again. */
  nameSkipped: boolean;
  skipName: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

/** The hunter's name and initials, saved in the phone's database, for any screen. */
export function useProfile(): ProfileContextValue {
  const value = useContext(ProfileContext);
  if (!value) throw new Error('useProfile must be used inside <ProfileProvider>');
  return value;
}

export function ProfileProvider({
  db,
  now = Date.now,
  children,
}: {
  db: SqlDatabase;
  now?: () => number;
  children: ReactNode;
}) {
  const [profile, setProfile] = useState<MyProfile | null>();
  const [nameSkipped, setNameSkipped] = useState(false);
  useEffect(() => {
    void Promise.all([loadProfile(db), loadNameSkippedAt(db)]).then(([saved, skippedAt]) => {
      setNameSkipped(skippedAt !== null);
      setProfile(saved);
    });
  }, [db]);
  const save = useCallback(
    async (next: MyProfile) => {
      await saveProfile(db, next);
      setProfile(next);
    },
    [db],
  );
  const skipName = useCallback(async () => {
    await markNameSkipped(db, now());
    setNameSkipped(true);
  }, [db, now]);
  const value = useMemo(
    () => ({ profile, save, nameSkipped, skipName }),
    [profile, save, nameSkipped, skipName],
  );
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
