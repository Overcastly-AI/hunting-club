import { codeDigits, CognitoAuthError, emailCodeRules, type CodeChallenge } from '@huntclub/shared';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { Field } from '../components/Field';
import { makeStyles, textStyles } from '../theme';
import { useClub } from './ClubProvider';
import { clubCopy } from './copy';

const copy = clubCopy.signIn;

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const attempt = async (step: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await step();
    } catch (e) {
      setError(copy.errors[e instanceof CognitoAuthError ? e.code : 'unknown']);
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () => attempt(async () => setChallenge(await session.requestCode(email)));
  const confirm = () => {
    // Checked on submit: a short or over-long paste says how many digits, never truncates.
    if (code.length !== emailCodeRules(challenge!.kind).length) {
      setError(copy.codeIncomplete(challenge!.kind));
      return;
    }
    return attempt(async () => {
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
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Button
            variant="primary"
            label={busy ? copy.sending : copy.sendCode}
            disabled={busy || !email.includes('@')}
            onPress={() => void sendCode()}
          />
        </>
      ) : (
        <>
          <Text style={styles.body}>{copy.codeSent(challenge.email)}</Text>
          <Field
            label={copy.code}
            value={code}
            onChangeText={(text) => setCode(codeDigits(text))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
          />
          <Text style={styles.body}>{copy.codeHelp(challenge.kind)}</Text>
          <Button
            variant="primary"
            label={busy ? copy.signingIn : copy.confirm}
            disabled={busy || code.length === 0}
            onPress={() => void confirm()}
          />
          <Button label={copy.useOtherEmail} onPress={() => setChallenge(null)} />
        </>
      )}
      {error ? (
        <Text accessibilityRole="alert" style={styles.body}>
          {error}
        </Text>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles((theme) => ({
  body: { ...textStyles.body, color: theme.colors.text },
}));
