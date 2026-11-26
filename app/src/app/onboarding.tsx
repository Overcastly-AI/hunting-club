import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { JOIN_ROUTE } from '../club/routes';
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
      // Club sign-in and join, then back here to carry on.
      onClubCode={(link) => router.push({ pathname: JOIN_ROUTE, params: { link } })}
      onFinish={() => {
        void markOnboarded(db, Date.now()).then(() => router.replace('/'));
      }}
    />
  );
}
