import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { loadProfile, saveProfile, type MyProfile } from '../db/appState';
import type { SqlDatabase } from '../db/types';

export type ProfileContextValue = {
  /** undefined while loading; null before the hunter enters a name. */
  profile: MyProfile | null | undefined;
  save: (profile: MyProfile) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

/** The hunter's name and initials, saved in the phone's database, for any screen. */
export function useProfile(): ProfileContextValue {
  const value = useContext(ProfileContext);
  if (!value) throw new Error('useProfile must be used inside <ProfileProvider>');
  return value;
}

export function ProfileProvider({ db, children }: { db: SqlDatabase; children: ReactNode }) {
  const [profile, setProfile] = useState<MyProfile | null>();
  useEffect(() => {
    void loadProfile(db).then(setProfile);
  }, [db]);
  const save = useCallback(
    async (next: MyProfile) => {
      await saveProfile(db, next);
      setProfile(next);
    },
    [db],
  );
  const value = useMemo(() => ({ profile, save }), [profile, save]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
