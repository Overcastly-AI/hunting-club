import { PairRadioScreen } from './PairRadioScreen';

type Props = {
  /** The radio is connected and the hunter tapped Done. */
  onNext: () => void;
  /** The hunter chose "Set up later". */
  onSkip: () => void;
};

/**
 * Onboarding step 1 (spec: Screens → 5. Onboarding): pair a radio over
 * Bluetooth, or set it up later. Ready for the onboarding flow to use.
 */
export function PairRadioStep({ onNext, onSkip }: Props) {
  return <PairRadioScreen onDone={onNext} onSkip={onSkip} />;
}
