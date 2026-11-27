import {
  APP_DESCRIPTION,
  APP_NAME,
  CLUB_PRICING,
  type ClubSession,
  type CodeChallenge,
  codeDigits,
  CognitoAuthError,
  emailCodeRules,
  isPlausibleEmail,
  LEGAL_PATHS,
  RESEND_CODE_COOLDOWN_SECONDS,
  signInCopy as copy,
} from '@huntclub/shared';
import { useCooldown } from '@huntclub/shared/useCooldown';
import { breakpoints } from '@huntclub/design';
import { Mail } from 'lucide-react';
import { useRef, useState, type ClipboardEvent, type FormEvent } from 'react';
import { LogoMark } from '../components/LogoMark';
import { usePageHeadingFocus } from '../components/Page';
import { Button, Field, Input, PageHeader } from '../components/ui';
import { SHELL } from '../components/ui/sizes';
import { ClubMap } from '../map/ClubMap';
import { useBasemap } from '../map/basemap';
import { SAMPLE_PACK } from '../map/samplePack';
import { SAMPLE_PLAN, SAMPLE_PROPERTY } from '../map/sampleProperty';

type Busy = null | 'send' | 'resend' | 'confirm';

/** The words under the form for someone with no account yet. */
export const NEW_HERE = `New here? Sign in with your email, then start your club with a ${CLUB_PRICING.trialDays}-day free trial.`;
/** The caption on the map behind the form: nobody is signed in, so it is a made-up club. */
export const SAMPLE_CAPTION = `Sample property: ${SAMPLE_PROPERTY.name}`;

/** Room the form's plate covers from the tablet width up (its width and margins), kept clear of the map. */
const DOOR_ROOM = 520;

/**
 * Email, then the code from that email (the shared sign-in client). No passwords. Submit
 * stays enabled; input is checked on submit and problems show under the field. The form
 * floats on a plate over a sample property (docs/DESIGN.md: the map is the page).
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
  const cooldown = useCooldown(RESEND_CODE_COOLDOWN_SECONDS);
  const heading = usePageHeadingFocus();
  // The sample's aerial, read as My club reads a club's pack; the plain ground until it loads.
  const basemap = useBasemap(SAMPLE_PACK);
  // One confirm at a time: the last digit landing and a press of Enter must not both send it.
  const confirming = useRef(false);

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
    void run('send', async () => {
      setChallenge(await session.requestCode(email.trim()));
      cooldown.start();
    });
  };

  const resend = () => {
    if (!challenge || cooldown.remaining > 0) return;
    void run('resend', async () => {
      setChallenge(await session.requestCode(challenge.email));
      cooldown.start();
      setCode('');
      setNotice(copy.resent);
    });
  };

  const submitCode = (value: string) => {
    if (!challenge || confirming.current) return;
    if (value.length !== emailCodeRules(challenge.kind).length) {
      setError(null);
      setNotice(null);
      setFieldError(copy.codeIncomplete(challenge.kind));
      return;
    }
    setFieldError(null);
    confirming.current = true;
    void run('confirm', async () => {
      await session.confirmCode(challenge, value);
      onSignedIn(challenge.email);
    }).finally(() => {
      confirming.current = false;
    });
  };

  const confirm = (e: FormEvent) => {
    e.preventDefault();
    submitCode(code);
  };

  /** Digits only; the code goes as soon as its last digit lands. */
  const enterCode = (value: string) => {
    const digits = codeDigits(value);
    setCode(digits);
    if (challenge && digits.length === emailCodeRules(challenge.kind).length) submitCode(digits);
  };

  /**
   * A paste is read whole (spaces and dashes dropped) rather than cut at maxlength first:
   * a code with one digit too many is refused on submit, never silently shortened.
   */
  const pasteCode = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    enterCode(e.clipboardData.getData('text'));
  };

  const otherEmail = () => {
    setChallenge(null);
    setCode('');
    setFieldError(null);
    setError(null);
    setNotice(null);
  };

  return (
    <div className="signin">
      <section className="signin__door" aria-labelledby="sign-in-title">
        <div className="signin__brand">
          <LogoMark size={SHELL.logo} />
          <p className="signin__app-name">{APP_NAME}</p>
        </div>
        <PageHeader
          title={copy.title}
          titleId="sign-in-title"
          titleRef={heading}
          description={APP_DESCRIPTION}
        />
        {challenge === null ? (
          <form className="signin__form" onSubmit={sendCode} noValidate>
            <Field label={copy.email} error={fieldError}>
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={copy.emailPlaceholder}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Button
              variant="primary"
              size="lg"
              block
              type="submit"
              icon={Mail}
              loading={busy === 'send'}
            >
              {busy === 'send' ? copy.sending : copy.sendCode}
            </Button>
            <p className="signin__note">{copy.intro}</p>
          </form>
        ) : (
          <form className="signin__form" onSubmit={confirm} noValidate>
            <p className="signin__note">{copy.codeSent(challenge.email)}</p>
            <Field
              label={copy.code(challenge.kind)}
              hint={copy.codeHelp(challenge.kind)}
              error={fieldError}
            >
              <Input
                className="signin__code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={emailCodeRules(challenge.kind).length}
                required
                value={code}
                onChange={(e) => enterCode(e.target.value)}
                onPaste={pasteCode}
              />
            </Field>
            <Button variant="primary" size="lg" block type="submit" loading={busy === 'confirm'}>
              {busy === 'confirm' ? copy.signingIn : copy.confirm}
            </Button>
            <div className="signin__secondary">
              <Button
                variant="secondary"
                disabled={busy !== null || cooldown.remaining > 0}
                onClick={resend}
              >
                {busy === 'resend'
                  ? copy.sending
                  : cooldown.remaining > 0
                    ? copy.resendIn(cooldown.remaining)
                    : copy.resend}
              </Button>
              <Button variant="tertiary" disabled={busy !== null} onClick={otherEmail}>
                {copy.useOtherEmail}
              </Button>
            </div>
          </form>
        )}
        {notice ? (
          <p className="signin__note" role="status">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="signin__error" role="alert">
            {error}
          </p>
        ) : null}
        <footer className="signin__footer">
          <p>{NEW_HERE}</p>
          <p className="signin__legal">
            <a href={LEGAL_PATHS.privacy}>Privacy</a>
            <a href={LEGAL_PATHS.terms}>Terms</a>
          </p>
        </footer>
      </section>
      <ClubMap
        className="signin__map"
        {...SAMPLE_PLAN}
        basemap={basemap}
        label={`${SAMPLE_CAPTION}: a property line with two areas and three stands.`}
        insets={({ width }) =>
          width >= breakpoints.tablet ? { left: DOOR_ROOM } : { top: 56, bottom: 56 }
        }
      >
        <p className="signin__sample" aria-hidden="true">
          {SAMPLE_CAPTION}
        </p>
      </ClubMap>
    </div>
  );
}
