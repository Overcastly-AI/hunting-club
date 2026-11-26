import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { loadProfile, markOnboarded, saveProfile, type MyProfile } from '../db/appState';
import { OnboardingScreen } from '../onboarding/OnboardingScreen';

export default function OnboardingRoute() {
  const db = useSQLiteContext();
  const [profile, setProfile] = useState<MyProfile | null>();
  useEffect(() => {
    void loadProfile(db).then(setProfile);
  }, [db]);
  if (profile === undefined) return null;

  return (
    <OnboardingScreen
      profile={profile}
      onProfile={(p) => saveProfile(db, p)}
      onFinish={() => {
        void markOnboarded(db, Date.now()).then(() => router.replace('/'));
      }}
    />
  );
}
