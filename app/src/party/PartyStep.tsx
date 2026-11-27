import { PartyError } from '@huntclub/core';
import { ScanQrCode, Users } from 'lucide-react-native';
import { useContext, useState } from 'react';
import { Text } from 'react-native';

import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { QrScanner } from '../components/QrScanner';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { ensureCameraPermission } from '../permissions/camera';
import { radioCopy } from '../radio/copy';
import { makeStyles, textStyles } from '../theme';
import { partyCopy } from './copy';
import { joinErrorText } from './joinError';
import { PartyRadioContext } from './PartyRadio';
import { usePartyView } from './usePartyView';

type Props = {
  onNext: () => void;
  /** A Club QR code was scanned: hand it to the club join screen (sign-in + join). */
  onClubCode: (link: string) => void;
};

type Busy = 'starting' | 'joining' | null;

/**
 * Onboarding step 2 (spec: Screens → 5. Onboarding): start a party, or join
 * one by scanning a friend's Party QR code.
 */
export function PartyStep({ onNext, onClubCode }: Props) {
  const styles = useStyles();
  const copy = partyCopy.step;
  const service = useContext(PartyRadioContext);
  const party = usePartyView(service);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const run = async (
    kind: Exclude<Busy, null>,
    action: () => Promise<unknown>,
    onError: (e: unknown) => void,
  ) => {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (e) {
      onError(e);
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
    if (!service) return;
    void run(
      'joining',
      () => service.join(link),
      (e) =>
        e instanceof PartyError && e.code === 'club-link'
          ? onClubCode(link)
          : setError(joinErrorText(e)),
    );
  };

  return (
    <Screen title={copy.title} description={copy.body}>
      {party ? (
        <>
          <Banner tone="success">{party.role === 'creator' ? copy.started : copy.joined}</Banner>
          <Button variant="primary" size="lg" label={copy.continue} onPress={onNext} />
        </>
      ) : (
        <>
          {!service ? <Banner tone="info">{copy.needsRadio}</Banner> : null}
          {error ? (
            <Banner tone="warning" live>
              {error}
            </Banner>
          ) : null}
          {busy === 'joining' ? (
            <Banner tone="info" live>
              {partyCopy.scan.joining}
            </Banner>
          ) : null}
          <Button
            variant="primary"
            size="lg"
            icon={Users}
            label={busy === 'starting' ? copy.starting : copy.start}
            loading={busy === 'starting'}
            disabled={!service || busy === 'joining'}
            onPress={() =>
              void run(
                'starting',
                () => service!.create(),
                () => setError(copy.failed),
              )
            }
          />
          <Button
            icon={ScanQrCode}
            label={copy.scan}
            disabled={!service || busy !== null}
            onPress={() => void scan()}
          />
          <Button
            variant="tertiary"
            label={radioCopy.pair.setUpLater}
            onPress={onNext}
            disabled={busy !== null}
          />
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

const useStyles = makeStyles((theme) => ({
  body: { ...textStyles.bodyLarge, color: theme.colors.textSecondary },
}));
