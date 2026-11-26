import {
  codeDigits,
  CognitoAuthError,
  emailCodeRules,
  RESEND_CODE_COOLDOWN_SECONDS,
  type CodeChallenge,
} from '@huntclub/shared';
import { useState } from 'react';
import { LogIn, Mail, RefreshCw } from 'lucide-react-native';
import { Text } from 'react-native';

import { useAnnounce } from '../components/announce';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { Field } from '../components/Field';
import { useCooldown } from '../hooks/useCooldown';
import { makeStyles, textStyles } from '../theme';
import { useClub } from './ClubProvider';
import { clubCopy } from './copy';

const copy = clubCopy.signIn;

type Busy = 'send' | 'resend' | 'confirm' | null;

/**
 * Email → the code from the email → signed in. Then any clubs on the phone sync. The
 * code's length depends on the challenge (emailCodeRules): a new account's code and a
 * sign-in code differ.
 */
export function SignInScreen({ onDone }: { onDone: () => void }) {
  const styles = useStyles();
  const { session, reload, sync } = useClub();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<CodeChallenge | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const cooldown = useCooldown(RESEND_CODE_COOLDOWN_SECONDS);
  const waiting = challenge !== null && cooldown.remaining > 0;

  // Said once when the wait starts and once when a new code can be sent, never every second:
  // the button's own text counts down but is not a live region. A wait always starts at the
  // full cooldown (every code sent restarts it), so this text changes only at those two points.
  const waitNotice =
    challenge === null
      ? undefined
      : waiting
        ? copy.resendIn(RESEND_CODE_COOLDOWN_SECONDS)
        : copy.resend;
  useAnnounce(waitNotice, { withoutLiveRegion: true });

  const attempt = async (kind: Exclude<Busy, null>, step: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      await step();
    } catch (e) {
      setError(copy.errors[e instanceof CognitoAuthError ? e.code : 'unknown']);
    } finally {
      setBusy(null);
    }
  };

  const sendCode = () =>
    attempt('send', async () => {
      setChallenge(await session.requestCode(email));
      cooldown.start();
    });
  const resend = () =>
    attempt('resend', async () => {
      setChallenge(await session.requestCode(challenge!.email));
      setCode('');
      setNotice(copy.resent);
      cooldown.start();
    });
  const confirm = () => {
    // Checked on submit: a short or over-long paste says how many digits, never truncates.
    if (code.length !== emailCodeRules(challenge!.kind).length) {
      setNotice(null);
      setError(copy.codeIncomplete(challenge!.kind));
      return;
    }
    return attempt('confirm', async () => {
      await session.confirmCode(challenge!, code);
      await reload();
      onDone();
      await sync().catch(() => undefined);
    });
  };

  return (
    <Screen title={copy.title} description={copy.intro}>
      {challenge === null ? (
        <>
          <Field
            label={copy.email}
            placeholder={copy.emailPlaceholder}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Button
            variant="primary"
            size="lg"
            icon={Mail}
            label={busy === 'send' ? copy.sending : copy.sendCode}
            loading={busy === 'send'}
            disabled={busy === null && !email.includes('@')}
            onPress={() => void sendCode()}
          />
        </>
      ) : (
        <>
          <Text style={styles.body}>{copy.codeSent(challenge.email)}</Text>
          <Field
            label={copy.code}
            hint={copy.codeHelp(challenge.kind)}
            value={code}
            onChangeText={(text) => setCode(codeDigits(text))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            style={styles.code}
          />
          <Button
            variant="primary"
            size="lg"
            icon={LogIn}
            label={busy === 'confirm' ? copy.signingIn : copy.confirm}
            loading={busy === 'confirm'}
            disabled={busy === 'resend' || (busy === null && code.length === 0)}
            onPress={() => void confirm()}
          />
          <Button
            variant="tertiary"
            icon={RefreshCw}
            label={
              waiting
                ? copy.resendIn(cooldown.remaining)
                : busy === 'resend'
                  ? copy.sending
                  : copy.resend
            }
            loading={busy === 'resend'}
            disabled={waiting || busy === 'confirm'}
            onPress={() => void resend()}
          />
          <Button
            variant="tertiary"
            label={copy.useOtherEmail}
            disabled={busy !== null}
            onPress={() => setChallenge(null)}
          />
        </>
      )}
      {notice ? (
        <Banner tone="success" live>
          {notice}
        </Banner>
      ) : null}
      {error ? (
        <Banner tone="danger" live>
          {error}
        </Banner>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles((theme) => ({
  body: { ...textStyles.bodyLarge, color: theme.colors.text },
  /** The code itself: code-field type (24/32, fixed-width digits). */
  code: { ...textStyles.codeField, color: theme.colors.text },
}));
