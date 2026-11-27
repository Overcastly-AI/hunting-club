import type { Owner } from '@huntclub/mesh';

import { Screen } from '../components/Screen';
import type { MyProfile } from '../db/appState';
import { nameCopy } from '../profile/copy';
import { NameForm } from '../profile/ProfileFields';
import { onboardingCopy } from './copy';

type Props = {
  initial?: MyProfile | null;
  /** The radio paired in the step before, if any: its name is the default. */
  radio?: Partial<Owner> | null;
  onNext: (profile: MyProfile) => void;
  /** Leaves the name unset: the first check-in asks once more. */
  onSkip: () => void;
};

/** Onboarding "Enter your name and initials" (the name prompt at first run). */
export function NameStep({ initial, radio, onNext, onSkip }: Props) {
  return (
    <Screen title={nameCopy.title} description={nameCopy.body}>
      <NameForm
        initial={initial}
        radio={radio}
        saveLabel={onboardingCopy.name.continue}
        onSave={onNext}
        onSkip={onSkip}
      />
    </Screen>
  );
}
