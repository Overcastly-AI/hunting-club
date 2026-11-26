import { router } from 'expo-router';

import { OnboardingScreen } from '../onboarding/OnboardingScreen';

export default function OnboardingRoute() {
  return <OnboardingScreen onFinish={() => router.replace('/')} />;
}
