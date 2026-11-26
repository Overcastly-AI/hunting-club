import {
  CLUB_PRICING,
  ClubCreateRequestSchema,
  DISPLAY_NAME_MAX,
  INITIALS_MAX,
  type Club,
} from '@huntclub/shared';
import { useState, type FormEvent } from 'react';
import type { ClubApi } from '../api/types';
import { Field } from '../components/Field';
import { Loadable } from '../components/Loadable';
import { PageHeading } from '../components/PageHeading';
import { isOffline, useAsync } from '../components/useAsync';

/** Your club, or a form to start one. Payment is on the Billing page. */
export function MyClub(props: { api: ClubApi }) {
  const state = useAsync(() => props.api.getClub(), [props.api]);
  const [created, setCreated] = useState(false);

  return (
    <section aria-labelledby="club-title">
      <PageHeading id="club-title">My club</PageHeading>
      <Loadable state={state}>
        {(club) =>
          club ? (
            <ClubSummary club={club} created={created} />
          ) : (
            <CreateClub
              api={props.api}
              onCreated={() => {
                setCreated(true);
                state.reload();
              }}
            />
          )
        }
      </Loadable>
    </section>
  );
}

function ClubSummary({ club, created }: { club: Club; created: boolean }) {
  return (
    <div className="panel">
      {created ? (
        <p role="status">
          Club created. Start your {CLUB_PRICING.trialDays}-day free trial on{' '}
          <a href="#/billing">Billing</a>.
        </p>
      ) : null}
      <h2>{club.name}</h2>
      <p className="muted">
        {club.acreage === undefined
          ? 'Acreage not set'
          : `${club.acreage.toLocaleString('en-US')} acres`}
      </p>
      <a className="button" href="#/billing">
        Billing and payment
      </a>
    </div>
  );
}

/** From the shared initials rule (initialsSchema), so the hint never drifts from it. */
const INITIALS_HINT = `Up to ${INITIALS_MAX} letters or numbers, shown on the map`;

/** Inline errors, by the request schema's field path. */
const CREATE_ERRORS = {
  'club.name': 'Enter the club name.',
  'admin.displayName': 'Enter your name.',
  'admin.initials': `Enter your initials: up to ${INITIALS_MAX} letters or numbers.`,
} as const;
type CreateField = keyof typeof CREATE_ERRORS;

function CreateClub(props: { api: ClubApi; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [initials, setInitials] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<Partial<Record<CreateField, string>>>({});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // The shared request schema is the one rule; the server checks the same.
    const request = ClubCreateRequestSchema.safeParse({
      club: { name: name.trim() },
      admin: { displayName: displayName.trim(), initials: initials.trim().toUpperCase() },
    });
    if (!request.success) {
      const fields: Partial<Record<CreateField, string>> = {};
      for (const issue of request.error.issues) {
        const field = issue.path.join('.') as CreateField;
        if (field in CREATE_ERRORS) fields[field] ??= CREATE_ERRORS[field];
      }
      setInvalid(fields);
      return;
    }
    setInvalid({});
    setBusy(true);
    setError(null);
    try {
      await props.api.createClub(request.data);
      props.onCreated();
    } catch (e) {
      setError(
        isOffline(e)
          ? 'No connection. Try again when you are online.'
          : 'Could not create the club. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <p>Start a club to share stands, areas and the club key with your members.</p>
      <Field
        label="Club name"
        required
        maxLength={80}
        error={invalid['club.name']}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Field
        label="Your name"
        hint="Shown to club members on the map and in chat."
        required
        maxLength={DISPLAY_NAME_MAX}
        error={invalid['admin.displayName']}
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />
      <Field
        label="Your initials"
        hint={INITIALS_HINT}
        required
        maxLength={INITIALS_MAX}
        error={invalid['admin.initials']}
        value={initials}
        onChange={(e) => setInitials(e.target.value)}
      />
      <button className="button primary" type="submit" disabled={busy}>
        {busy ? 'Creating club…' : 'Create club'}
      </button>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="muted">Next, pay for the club on the Billing page.</p>
    </form>
  );
}
