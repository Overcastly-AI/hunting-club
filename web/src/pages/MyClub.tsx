import { DISPLAY_NAME_MAX, INITIALS_MAX, type Club } from '@huntclub/shared';
import { useState, type FormEvent } from 'react';
import type { ClubApi } from '../api/types';
import { Field } from '../components/Field';
import { Loadable } from '../components/Loadable';
import { useAsync } from '../components/useAsync';

/** Your club, or a form to start one. Payment (Stripe Checkout) arrives in Milestone 9. */
export function MyClub(props: { api: ClubApi }) {
  const [reload, setReload] = useState(0);
  const state = useAsync(() => props.api.getClub(), [props.api, reload]);

  return (
    <section aria-labelledby="club-title">
      <h1 id="club-title">My club</h1>
      <Loadable state={state}>
        {(club) =>
          club ? (
            <ClubSummary club={club} />
          ) : (
            <CreateClub api={props.api} onCreated={() => setReload((n) => n + 1)} />
          )
        }
      </Loadable>
    </section>
  );
}

function ClubSummary({ club }: { club: Club }) {
  return (
    <div className="panel">
      <h2>{club.name}</h2>
      <p className="muted">
        {club.acreage === undefined
          ? 'Acreage not set'
          : `${club.acreage.toLocaleString('en-US')} acres`}
      </p>
    </div>
  );
}

function CreateClub(props: { api: ClubApi; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [initials, setInitials] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = [name, displayName, initials].every((v) => v.trim() !== '');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await props.api.createClub({
        club: { name: name.trim() },
        admin: { displayName: displayName.trim(), initials: initials.trim().toUpperCase() },
      });
      props.onCreated();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <p>Start a club to share stands, areas and the club key with your members.</p>
      <Field
        label="Club name"
        required
        maxLength={80}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Field
        label="Your name"
        hint="Shown to club members on the map and in chat."
        required
        maxLength={DISPLAY_NAME_MAX}
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />
      <Field
        label="Your initials"
        required
        maxLength={INITIALS_MAX}
        value={initials}
        onChange={(e) => setInitials(e.target.value)}
      />
      <button className="button primary" type="submit" disabled={busy || !ready}>
        Create club
      </button>
      <h2>Subscription</h2>
      <p className="muted">
        Club features need a subscription. Checkout opens here once payments are set up.
      </p>
      <button className="button" type="button" disabled>
        Continue to payment
      </button>
    </form>
  );
}
