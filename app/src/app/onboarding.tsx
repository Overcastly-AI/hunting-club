import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { loadProfile, markOnboarded, saveProfile, type MyProfile } from '../db/appState';
import { useMapPacks } from '../map/useMapPacks';
import { OnboardingScreen } from '../onboarding/OnboardingScreen';

export default function OnboardingRoute() {
  const db = useSQLiteContext();
  const [profile, setProfile] = useState<MyProfile | null>();
  // Downloads started here keep going; the Map tab shows their progress.
  const { start: downloadMap } = useMapPacks();
  useEffect(() => {
    void loadProfile(db).then(setProfile);
  }, [db]);
  if (profile === undefined) return null;

  return (
    <OnboardingScreen
      profile={profile}
      onProfile={(p) => saveProfile(db, p)}
      onDownloadMap={downloadMap}
      onFinish={() => {
        void markOnboarded(db, Date.now()).then(() => router.replace('/'));
      }}
    />
  );
}
