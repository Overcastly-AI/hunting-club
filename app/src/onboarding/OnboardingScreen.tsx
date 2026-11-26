import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { PairRadioStep } from '../radio/ui/PairRadioStep';
import { spacing } from '../theme';
import { onboardingCopy } from './copy';

/**
 * Onboarding steps in order (spec: Screens → 5. Onboarding). Later steps
 * (party or club, name, permissions, map download) are added here.
 */
export const ONBOARDING_STEPS = ['welcome', 'pairRadio'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

type Props = {
  /** Called after the last step. */
  onFinish: () => void;
};

export function OnboardingScreen({ onFinish }: Props) {
  const [index, setIndex] = useState(0);
  const step = ONBOARDING_STEPS[index];
  const next = () => (index + 1 < ONBOARDING_STEPS.length ? setIndex(index + 1) : onFinish());

  if (step === 'pairRadio') {
    // "Set up later" skips pairing; the Party tab offers it again.
    return <PairRadioStep onNext={next} onSkip={next} />;
  }
  return (
    <Screen title={onboardingCopy.welcome.title} description={onboardingCopy.welcome.body}>
      <View style={styles.actions}>
        <Button variant="primary" label={onboardingCopy.welcome.start} onPress={next} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.md },
});
