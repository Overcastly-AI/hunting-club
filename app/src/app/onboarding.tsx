import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { markOnboarded } from '../db/appState';
import { OnboardingScreen } from '../onboarding/OnboardingScreen';

export default function OnboardingRoute() {
  const db = useSQLiteContext();
  return (
    <OnboardingScreen
      onFinish={() => {
        void markOnboarded(db, Date.now()).then(() => router.replace('/'));
      }}
    />
  );
}
