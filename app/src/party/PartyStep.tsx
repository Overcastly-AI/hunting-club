import { useContext, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button } from '../components/Button';
import { QrScanner } from '../components/QrScanner';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { ensureCameraPermission } from '../permissions/camera';
import { radioCopy } from '../radio/copy';
import { colors, textStyles } from '../theme';
import { partyCopy } from './copy';
import { joinErrorText } from './joinError';
import { PartyRadioContext } from './PartyRadio';
import { usePartyView } from './usePartyView';

type Props = {
  onNext: () => void;
};

type Busy = 'starting' | 'joining' | null;

/**
 * Onboarding step 2 (spec: Screens → 5. Onboarding): start a party, or join
 * one by scanning a friend's Party QR code.
 */
export function PartyStep({ onNext }: Props) {
  const copy = partyCopy.step;
  const service = useContext(PartyRadioContext);
  const party = usePartyView(service);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const run = async (kind: Exclude<Busy, null>, action: () => Promise<unknown>) => {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(kind === 'joining' ? joinErrorText(e) : copy.failed);
    } finally {
      setBusy(null);
    }
  };

  const scan = async () => {
    setError(null);
    if (await ensureCameraPermission()) setScanning(true);
  };

  const join = (link: string) => {
    setScanning(false);
    if (service) void run('joining', () => service.join(link));
  };

  return (
    <Screen title={copy.title} description={copy.body}>
      {party ? (
        <>
          <Text style={styles.body}>{party.role === 'creator' ? copy.started : copy.joined}</Text>
          <Button variant="primary" label={copy.continue} onPress={onNext} />
        </>
      ) : (
        <>
          {!service ? <Text style={styles.body}>{copy.needsRadio}</Text> : null}
          {error ? <Text style={styles.body}>{error}</Text> : null}
          {busy === 'joining' ? <Text style={styles.body}>{partyCopy.scan.joining}</Text> : null}
          <Button
            variant="primary"
            label={busy === 'starting' ? copy.starting : copy.start}
            disabled={!service || busy !== null}
            onPress={() => void run('starting', () => service!.create())}
          />
          <Button
            label={copy.scan}
            disabled={!service || busy !== null}
            onPress={() => void scan()}
          />
          <Button label={radioCopy.pair.setUpLater} onPress={onNext} disabled={busy !== null} />
        </>
      )}
      <Sheet visible={scanning} title={partyCopy.scan.title} onClose={() => setScanning(false)}>
        <Text style={styles.body}>{partyCopy.scan.hint}</Text>
        {scanning ? (
          <QrScanner onScan={join} accessibilityLabel={partyCopy.scan.cameraLabel} />
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { ...textStyles.bodyLarge, color: colors.textSecondary },
});
