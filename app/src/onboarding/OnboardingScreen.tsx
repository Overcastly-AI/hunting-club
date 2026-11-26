import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { PairRadioScreen } from '../radio/ui/PairRadioScreen';
import { spacing } from '../theme';
import { onboardingCopy } from './copy';

/**
 * Onboarding steps in order (spec: Screens → 5. Onboarding). Only step 1,
 * welcome and pairing a radio, exists so far; later steps (party or club,
 * name, permissions, map download) are added here as they are built.
 */
export const ONBOARDING_STEPS = ['welcome', 'pairRadio'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

type Props = {
  /** Called after the last step, or when the hunter chooses to set up later. */
  onFinish: () => void;
};

export function OnboardingScreen({ onFinish }: Props) {
  const [index, setIndex] = useState(0);
  const step = ONBOARDING_STEPS[index];
  const next = () => (index + 1 < ONBOARDING_STEPS.length ? setIndex(index + 1) : onFinish());

  if (step === 'pairRadio') {
    return <PairRadioScreen onDone={next} onSkip={onFinish} />;
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
