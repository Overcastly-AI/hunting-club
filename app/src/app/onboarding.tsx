import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { markOnboarded } from '../db/appState';
import { useMapPacks } from '../map/useMapPacks';
import { OnboardingScreen } from '../onboarding/OnboardingScreen';
import { useProfile } from '../profile/ProfileProvider';

export default function OnboardingRoute() {
  const db = useSQLiteContext();
  // Saving the profile also writes the name to the radio (OwnerSync).
  const { profile, save } = useProfile();
  // Downloads started here keep going; the Map tab shows their progress.
  const { start: downloadMap } = useMapPacks();
  if (profile === undefined) return null;

  return (
    <OnboardingScreen
      profile={profile}
      onProfile={save}
      onDownloadMap={downloadMap}
      onFinish={() => {
        void markOnboarded(db, Date.now()).then(() => router.replace('/'));
      }}
    />
  );
}
