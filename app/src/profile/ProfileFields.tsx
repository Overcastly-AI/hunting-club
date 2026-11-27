import { profileFromOwner, type Owner } from '@huntclub/mesh';
import {
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_PROBLEMS,
  displayNameProblem,
  INITIALS_MAX,
  INITIALS_PROBLEM,
  initialsSchema,
  parseMemberProfile,
  suggestInitials,
} from '@huntclub/shared';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '../components/Button';
import { Field } from '../components/Field';
import type { MyProfile } from '../db/appState';
import { makeStyles, spacing } from '../theme';
import { nameCopy } from './copy';

type DraftSource = {
  /** The profile saved on this phone, if any: it wins over the radio. */
  initial?: MyProfile | null;
  /** The linked radio's owner (long and short name): the default when nothing is saved. */
  radio?: Partial<Owner> | null;
};

/**
 * A name and initials being typed, starting from the saved profile, else the radio's name.
 * Until the hunter types, the radio's name is read live, so a radio that links after the
 * prompt opens still fills it in. Initials follow a typed name until they are typed too
 * (a saved profile keeps its own).
 */
export function useProfileDraft({ initial, radio }: DraftSource) {
  const suggestion = initial ?? profileFromOwner(radio);
  const [typedName, setTypedName] = useState<string | null>(null);
  const [typedInitials, setTypedInitials] = useState<string | null>(null);
  const displayName = typedName ?? suggestion?.displayName ?? '';
  const initials =
    typedInitials ??
    (typedName !== null && !initial ? suggestInitials(typedName) : (suggestion?.initials ?? ''));

  return {
    displayName,
    initials,
    /** The name shown is the radio's, untouched. */
    fromRadio: !initial && !!suggestion && typedName === null,
    profile: parseMemberProfile({ displayName, initials }),
    setDisplayName: setTypedName,
    setInitials: setTypedInitials,
  };
}

export type ProfileDraft = ReturnType<typeof useProfileDraft>;

/** The error to show for a draft's name: never for an empty field (the button says it). */
function nameError(displayName: string): string | undefined {
  const problem = displayNameProblem(displayName);
  return problem && problem !== 'empty' ? DISPLAY_NAME_PROBLEMS[problem] : undefined;
}

function initialsError(initials: string): string | undefined {
  const typed = initials.trim().toLocaleUpperCase();
  return typed && !initialsSchema.safeParse(typed).success ? INITIALS_PROBLEM : undefined;
}

/** The name and initials fields, held to the shared name rules (@huntclub/shared names.ts). */
export function ProfileFields({
  draft,
  nameLabel = nameCopy.nameLabel,
  initialsLabel = nameCopy.initialsLabel,
}: {
  draft: ProfileDraft;
  nameLabel?: string;
  initialsLabel?: string;
}) {
  return (
    <>
      <Field
        label={nameLabel}
        value={draft.displayName}
        maxLength={DISPLAY_NAME_MAX}
        autoCapitalize="words"
        autoComplete="name"
        hint={draft.fromRadio ? nameCopy.fromRadio : undefined}
        error={nameError(draft.displayName)}
        onChangeText={draft.setDisplayName}
      />
      <Field
        label={initialsLabel}
        value={draft.initials}
        maxLength={INITIALS_MAX}
        autoCapitalize="characters"
        hint={nameCopy.initialsHint}
        error={initialsError(draft.initials)}
        onChangeText={draft.setInitials}
      />
    </>
  );
}

type NameFormProps = DraftSource & {
  /** The main button's word: "Continue" in onboarding, "Save name" elsewhere. */
  saveLabel?: string;
  onSave: (profile: MyProfile) => void;
  /** "Skip for now": others keep seeing the radio's name. */
  onSkip?: () => void;
};

/**
 * The name prompt's form (onboarding, first check-in, Party tab): the fields, the main
 * button and, where the name can wait, Skip for now. Works offline: nothing leaves the phone
 * except the radio's own name.
 */
export function NameForm({
  initial,
  radio,
  saveLabel = nameCopy.save,
  onSave,
  onSkip,
}: NameFormProps) {
  const styles = useStyles();
  const draft = useProfileDraft({ initial, radio });
  const { profile } = draft;
  return (
    <View style={styles.form}>
      <ProfileFields draft={draft} />
      <Button
        variant="primary"
        size="lg"
        label={saveLabel}
        disabled={!profile}
        onPress={() => profile && onSave(profile)}
      />
      {onSkip ? <Button variant="tertiary" label={nameCopy.skip} onPress={onSkip} /> : null}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  form: { gap: spacing.sm + spacing.xs },
}));
