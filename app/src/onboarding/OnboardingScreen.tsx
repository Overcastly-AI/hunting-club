import { useState } from 'react';

import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import type { MyProfile } from '../db/appState';
import type { DownloadRequest } from '../map/offline';
import { PartyStep } from '../party/PartyStep';
import { useRadio } from '../radio/RadioProvider';
import { PairRadioStep } from '../radio/ui/PairRadioStep';
import { onboardingCopy } from './copy';
import { MapDownloadStep } from './MapDownloadStep';
import { NameStep } from './NameStep';
import { PermissionsStep } from './PermissionsStep';

/**
 * Onboarding steps in order (spec: Screens → 5. Onboarding).
 */
export const ONBOARDING_STEPS = [
  'welcome',
  'pairRadio',
  'party',
  'name',
  'permissions',
  'map',
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

type Props = {
  /** Called after the last step. */
  onFinish: () => void;
  /** Profile saved before, e.g. if onboarding was interrupted. */
  profile?: MyProfile | null;
  onProfile: (profile: MyProfile) => Promise<void>;
  /** A Club QR code was scanned in the party step (the app opens club join). */
  onClubCode: (link: string) => void;
  /** Starts an offline map download for the map step. */
  onDownloadMap: (request: DownloadRequest) => Promise<void>;
};

export function OnboardingScreen({
  onFinish,
  profile,
  onProfile,
  onClubCode,
  onDownloadMap,
}: Props) {
  const [index, setIndex] = useState(0);
  // The radio paired in the step before names the hunter by default.
  const { radio } = useRadio();
  const step = ONBOARDING_STEPS[index];
  const next = () => (index + 1 < ONBOARDING_STEPS.length ? setIndex(index + 1) : onFinish());

  if (step === 'map') {
    return <MapDownloadStep onNext={next} onDownload={onDownloadMap} />;
  }
  if (step === 'permissions') {
    return <PermissionsStep onNext={next} />;
  }
  if (step === 'name') {
    return (
      <NameStep
        initial={profile}
        radio={radio}
        onNext={(p) => void onProfile(p).then(next)}
        onSkip={next}
      />
    );
  }
  if (step === 'party') {
    return <PartyStep onNext={next} onClubCode={onClubCode} />;
  }
  if (step === 'pairRadio') {
    // "Set up later" skips pairing; the Party tab offers it again.
    return <PairRadioStep onNext={next} onSkip={next} />;
  }
  return (
    <Screen title={onboardingCopy.welcome.title} description={onboardingCopy.welcome.body}>
      <Button variant="primary" size="lg" label={onboardingCopy.welcome.start} onPress={next} />
    </Screen>
  );
}
