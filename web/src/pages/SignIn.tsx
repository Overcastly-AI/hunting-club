import {
  type ClubSession,
  type CodeChallenge,
  CognitoAuthError,
  EMAIL_CODE_LENGTH,
  signInCopy as copy,
} from '@huntclub/shared';
import { useState, type FormEvent } from 'react';
import { Field } from '../components/Field';

/** Email, then the code from that email (the shared sign-in client). No passwords. */
export function SignIn(props: { session: ClubSession; onSignedIn: (email: string) => void }) {
  const { session, onSignedIn } = props;
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<CodeChallenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(step: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await step();
    } catch (e) {
      setError(copy.errors[e instanceof CognitoAuthError ? e.code : 'unknown']);
    } finally {
      setBusy(false);
    }
  }

  const sendCode = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => setChallenge(await session.requestCode(email)));
  };

  const confirm = (e: FormEvent) => {
    e.preventDefault();
    if (!challenge) return;
    void run(async () => {
      await session.confirmCode(challenge, code);
      onSignedIn(challenge.email);
    });
  };

  return (
    <section aria-labelledby="sign-in-title">
      <h1 id="sign-in-title">{copy.title}</h1>
      {challenge === null ? (
        <form onSubmit={sendCode}>
          <p>{copy.intro}</p>
          <Field
            label={copy.email}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="button primary" type="submit" disabled={busy || !email.includes('@')}>
            {busy ? copy.sending : copy.sendCode}
          </button>
        </form>
      ) : (
        <form onSubmit={confirm}>
          <p>{copy.codeSent(challenge.email)}</p>
          <Field
            label={copy.code}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={EMAIL_CODE_LENGTH}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <button
            className="button primary"
            type="submit"
            disabled={busy || code.length !== EMAIL_CODE_LENGTH}
          >
            {copy.confirm}
          </button>{' '}
          <button
            className="button"
            type="button"
            disabled={busy}
            onClick={() => {
              setChallenge(null);
              setCode('');
            }}
          >
            {copy.useOtherEmail}
          </button>
        </form>
      )}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
