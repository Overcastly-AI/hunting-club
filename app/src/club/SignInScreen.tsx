import { CognitoAuthError, type CodeChallenge } from '@huntclub/shared';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { colors, textStyles } from '../theme';
import { useClub } from './ClubProvider';
import { clubCopy } from './copy';

const copy = clubCopy.signIn;

/** Email → 6-digit code → signed in. Then any clubs on the phone sync. */
export function SignInScreen({ onDone }: { onDone: () => void }) {
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
  const confirm = () =>
    attempt(async () => {
      await session.confirmCode(challenge!, code);
      await reload();
      onDone();
      await sync().catch(() => undefined);
    });

  return (
    <Screen title={copy.title} description={copy.intro}>
      {challenge === null ? (
        <>
          <TextField
            placeholder={copy.email}
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
          <TextField
            placeholder={copy.code}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={8}
          />
          <Button
            variant="primary"
            label={copy.confirm}
            disabled={busy || code.trim().length < 6}
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

const styles = StyleSheet.create({
  body: { ...textStyles.body, color: colors.text },
});
