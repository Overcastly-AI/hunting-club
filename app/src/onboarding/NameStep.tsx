import { DISPLAY_NAME_MAX, INITIALS_MAX } from '@huntclub/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import type { MyProfile } from '../db/appState';
import { spacing } from '../theme';
import { onboardingCopy } from './copy';
import { parseProfile, suggestInitials } from './profile';

type Props = {
  initial?: MyProfile | null;
  onNext: (profile: MyProfile) => void;
};

/** Onboarding "Enter your name and initials". Initials follow the name until edited. */
export function NameStep({ initial, onNext }: Props) {
  const copy = onboardingCopy.name;
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '');
  const [initials, setInitials] = useState(initial?.initials ?? '');
  const [initialsEdited, setInitialsEdited] = useState(Boolean(initial));
  const profile = parseProfile({ displayName, initials });

  return (
    <Screen title={copy.title} description={copy.body}>
      <View style={styles.fields}>
        <TextField
          placeholder={copy.nameLabel}
          value={displayName}
          maxLength={DISPLAY_NAME_MAX}
          autoCapitalize="words"
          autoComplete="name"
          onChangeText={(text) => {
            setDisplayName(text);
            if (!initialsEdited) setInitials(suggestInitials(text));
          }}
        />
        <TextField
          placeholder={copy.initialsLabel}
          value={initials}
          maxLength={INITIALS_MAX}
          autoCapitalize="characters"
          onChangeText={(text) => {
            setInitialsEdited(true);
            setInitials(text);
          }}
        />
      </View>
      <Button
        variant="primary"
        label={copy.continue}
        disabled={!profile}
        onPress={() => profile && onNext(profile)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fields: { gap: spacing.md },
});
