import {
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_PROBLEMS,
  DISPLAY_NAME_PURPOSE,
  displayNameProblem,
  INITIALS_HINT,
  INITIALS_MAX,
  INITIALS_PROBLEM,
  isEmailStandInName,
  parseMemberProfile,
  suggestInitials,
  type Member,
} from '@huntclub/shared';
import { useState, type FormEvent } from 'react';
import type { ClubApi } from '../api/types';
import { isOffline } from '../components/useAsync';
import { Button, Field, Input } from '../components/ui';

/** Every word the Your name prompt shows. */
export const YOUR_NAME = {
  title: 'Your name',
  standIn: (name: string) =>
    `Members see you as “${name}”, taken from your email. Enter the name you go by.`,
  nameLabel: 'Your name',
  initialsLabel: 'Your initials',
  save: 'Save name',
  saving: 'Saving name…',
  keep: (name: string) => `Keep “${name}”`,
  offline: 'No connection. Try again when you are online.',
  failed: 'Could not save your name. Try again.',
} as const;

/** "Keep" is remembered on this browser only (a convenience; nothing depends on it). */
const keptKey = (userId: string) => `huntclub.yourName.kept.${userId}`;

function wasKept(userId: string): boolean {
  try {
    return localStorage.getItem(keptKey(userId)) === '1';
  } catch {
    return false;
  }
}

function rememberKept(userId: string): void {
  try {
    localStorage.setItem(keptKey(userId), '1');
  } catch {
    // Storage blocked: the prompt shows again next visit, which is harmless.
  }
}

/**
 * Whether to ask the signed-in person for their name: their club name is still the stand-in
 * taken from their email (a seeded admin), and they haven't chosen to keep it here.
 */
export function needsYourName(
  me: Pick<Member, 'userId' | 'displayName'> | undefined,
  email: string | undefined,
): boolean {
  return !!me && isEmailStandInName(me.displayName, email) && !wasKept(me.userId);
}

/**
 * My club → Your name: a small prompt for a member whose name is only their email's stand-in.
 * It saves through the club API's own profile update (PATCH the member), held to the shared
 * name rules (@huntclub/shared names.ts), the same ones the app's name prompt uses.
 */
export function YourNamePrompt(props: {
  api: ClubApi;
  me: Pick<Member, 'userId' | 'displayName' | 'initials'>;
  onDone: () => void;
}) {
  const standIn = props.me.displayName;
  const [displayName, setDisplayName] = useState('');
  const [initials, setInitials] = useState('');
  const [initialsEdited, setInitialsEdited] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problem = displayNameProblem(displayName);
  const profile = parseMemberProfile({ displayName, initials });
  const nameError = checked || (problem && problem !== 'empty') ? problem : null;
  const initialsError = (checked || initials.trim() !== '') && !profile && !problem;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setChecked(true);
    if (!profile) return;
    setBusy(true);
    setError(null);
    try {
      await props.api.updateMyProfile(profile);
      props.onDone();
    } catch (err) {
      setError(isOffline(err) ? YOUR_NAME.offline : YOUR_NAME.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="side-section your-name" aria-labelledby="your-name">
      <h2 id="your-name" className="side-section__title">
        {YOUR_NAME.title}
      </h2>
      <form className="form-plate" onSubmit={submit} noValidate>
        <p className="form-note">
          {YOUR_NAME.standIn(standIn)} {DISPLAY_NAME_PURPOSE}
        </p>
        <Field
          label={YOUR_NAME.nameLabel}
          error={nameError ? DISPLAY_NAME_PROBLEMS[nameError] : undefined}
        >
          <Input
            required
            autoComplete="name"
            maxLength={DISPLAY_NAME_MAX}
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              if (!initialsEdited) setInitials(suggestInitials(e.target.value));
            }}
          />
        </Field>
        <Field
          label={YOUR_NAME.initialsLabel}
          hint={INITIALS_HINT}
          error={initialsError ? INITIALS_PROBLEM : undefined}
        >
          <Input
            required
            maxLength={INITIALS_MAX}
            value={initials}
            onChange={(e) => {
              setInitialsEdited(true);
              setInitials(e.target.value);
            }}
          />
        </Field>
        <div className="form-plate__actions">
          <Button variant="primary" type="submit" loading={busy}>
            {busy ? YOUR_NAME.saving : YOUR_NAME.save}
          </Button>
          <Button
            variant="tertiary"
            type="button"
            onClick={() => {
              rememberKept(props.me.userId);
              props.onDone();
            }}
          >
            {YOUR_NAME.keep(standIn)}
          </Button>
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
