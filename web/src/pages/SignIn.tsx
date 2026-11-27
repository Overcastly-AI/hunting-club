import {
  APP_DESCRIPTION,
  APP_NAME,
  type ClubSession,
  type CodeChallenge,
  codeDigits,
  CognitoAuthError,
  emailCodeRules,
  isPlausibleEmail,
  LEGAL_PATHS,
  signInCopy as copy,
} from '@huntclub/shared';
import { lazy, Suspense, useState, type FormEvent } from 'react';
import { Field } from '../components/Field';
import { LogoMark } from '../components/LogoMark';
import { usePageHeadingFocus } from '../components/Page';
import { PageHeader } from '../components/ui';

/**
 * The dawn scene behind the card: its own lazy chunk (sprites and CSS), so the form never waits
 * for it and signed-in pages never download it.
 */
const DawnBackground = lazy(() => import('../components/DawnBackground'));

type Busy = null | 'send' | 'resend' | 'confirm';

/**
 * Email, then the code from that email (the shared sign-in client). No passwords. Submit
 * stays enabled; input is checked on submit and problems show under the field.
 */
export function SignIn(props: {
  session: ClubSession;
  onSignedIn: (email: string) => void;
  /** Shown once on arrival, e.g. "Your session expired. Sign in again." */
  notice?: string;
}) {
  const { session, onSignedIn } = props;
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<CodeChallenge | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(props.notice ?? null);
  const [busy, setBusy] = useState<Busy>(null);
  const heading = usePageHeadingFocus();

  async function run(kind: Exclude<Busy, null>, step: () => Promise<void>) {
    if (busy) return;
    setBusy(kind);
    // One message at a time: a new attempt clears the last one.
    setFieldError(null);
    setError(null);
    setNotice(null);
    try {
      await step();
    } catch (e) {
      setError(copy.errors[e instanceof CognitoAuthError ? e.code : 'unknown']);
    } finally {
      setBusy(null);
    }
  }

  const sendCode = (e: FormEvent) => {
    e.preventDefault();
    if (!isPlausibleEmail(email)) {
      setError(null);
      setNotice(null);
      setFieldError(copy.errors.invalid_email);
      return;
    }
    setFieldError(null);
    void run('send', async () => setChallenge(await session.requestCode(email.trim())));
  };

  const resend = () => {
    if (!challenge) return;
    void run('resend', async () => {
      setChallenge(await session.requestCode(challenge.email));
      setCode('');
      setNotice(copy.resent);
    });
  };

  const confirm = (e: FormEvent) => {
    e.preventDefault();
    if (!challenge) return;
    if (code.length !== emailCodeRules(challenge.kind).length) {
      setError(null);
      setNotice(null);
      setFieldError(copy.codeIncomplete(challenge.kind));
      return;
    }
    setFieldError(null);
    void run('confirm', async () => {
      await session.confirmCode(challenge, code);
      onSignedIn(challenge.email);
    });
  };

  const otherEmail = () => {
    setChallenge(null);
    setCode('');
    setFieldError(null);
    setError(null);
    setNotice(null);
  };

  return (
    <div className="auth">
      <Suspense fallback={null}>
        <DawnBackground />
      </Suspense>
      <section className="auth-card" aria-labelledby="sign-in-title">
        <div className="auth-brand">
          <LogoMark size={48} />
          <div>
            <p className="auth-app-name">{APP_NAME}</p>
            <p className="muted">{APP_DESCRIPTION}</p>
          </div>
        </div>
        <PageHeader title={copy.title} titleId="sign-in-title" titleRef={heading} />
        {challenge === null ? (
          <form onSubmit={sendCode} noValidate>
            <p>{copy.intro}</p>
            <Field
              label={copy.email}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={copy.emailPlaceholder}
              required
              error={fieldError}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="button primary wide" type="submit" aria-busy={busy === 'send'}>
              {busy === 'send' ? copy.sending : copy.sendCode}
            </button>
          </form>
        ) : (
          <form onSubmit={confirm} noValidate>
            <p>{copy.codeSent(challenge.email)}</p>
            <Field
              label={copy.code}
              hint={copy.codeHelp(challenge.kind)}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              error={fieldError}
              value={code}
              // Digits only, nothing cut off: a long paste is checked on submit, not truncated.
              onChange={(e) => setCode(codeDigits(e.target.value))}
            />
            <button className="button primary wide" type="submit" aria-busy={busy === 'confirm'}>
              {busy === 'confirm' ? copy.signingIn : copy.confirm}
            </button>
            <div className="row auth-secondary">
              <button className="button" type="button" disabled={busy !== null} onClick={resend}>
                {busy === 'resend' ? copy.sending : copy.resend}
              </button>
              <button
                className="button"
                type="button"
                disabled={busy !== null}
                onClick={otherEmail}
              >
                {copy.useOtherEmail}
              </button>
            </div>
          </form>
        )}
        {notice ? (
          <p className="muted" role="status">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
      </section>
      <footer className="auth-footer muted">
        <a href={LEGAL_PATHS.privacy}>Privacy</a>
        <a href={LEGAL_PATHS.terms}>Terms</a>
      </footer>
    </div>
  );
}
