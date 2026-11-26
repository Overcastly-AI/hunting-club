import { useState, type FormEvent } from 'react';
import { DEMO_CODE } from '../auth/demo';
import {
  AuthError,
  CODE_PATTERN,
  type AuthClient,
  type AuthErrorCode,
  type CodeChallenge,
  type SignedIn,
} from '../auth/types';
import { Field } from '../components/Field';

const ERROR_TEXT: Record<AuthErrorCode, string> = {
  unknown_user: 'We could not find a club account for that email.',
  wrong_code: 'That code did not work. Check the newest email, or send a new code.',
  too_many_attempts: 'Too many tries. Wait a few minutes, then send a new code.',
  unavailable: 'Sign-in is not available right now. Try again soon.',
};

/** Email, then the 6-digit code from that email. No passwords. */
export function SignIn(props: { auth: AuthClient; onSignedIn: (user: SignedIn) => void }) {
  const { auth, onSignedIn } = props;
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
      setError(ERROR_TEXT[e instanceof AuthError ? e.code : 'unavailable']);
    } finally {
      setBusy(false);
    }
  }

  const sendCode = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => setChallenge(await auth.requestCode(email.trim())));
  };

  const verify = (e: FormEvent) => {
    e.preventDefault();
    if (!challenge) return;
    void run(async () => onSignedIn(await auth.verifyCode(challenge, code.trim())));
  };

  return (
    <section aria-labelledby="sign-in-title">
      <h1 id="sign-in-title">Sign in</h1>
      {auth.live ? null : (
        <p className="banner">
          Demo mode: sign-in is not connected yet. Use any email and the code {DEMO_CODE}.
        </p>
      )}
      {challenge === null ? (
        <form onSubmit={sendCode}>
          <p>We will email you a 6-digit code. There is no password to remember.</p>
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="button primary" type="submit" disabled={busy || !email.includes('@')}>
            Email me a code
          </button>
        </form>
      ) : (
        <form onSubmit={verify}>
          <p>
            We sent a code to <strong>{challenge.email}</strong>.
          </p>
          <Field
            label="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <button
            className="button primary"
            type="submit"
            disabled={busy || !CODE_PATTERN.test(code)}
          >
            Sign in
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
            Use a different email
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
