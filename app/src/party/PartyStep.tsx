import { useContext, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { radioCopy } from '../radio/copy';
import { colors, textStyles } from '../theme';
import { partyCopy } from './copy';
import { PartyRadioContext } from './PartyRadio';
import { usePartyView } from './usePartyView';

type Props = {
  onNext: () => void;
};

/**
 * Onboarding step 2 (spec: Screens → 5. Onboarding): start a party. Joining
 * by scanning a Party or Club QR code is added with the camera module.
 */
export function PartyStep({ onNext }: Props) {
  const copy = partyCopy.step;
  const service = useContext(PartyRadioContext);
  const party = usePartyView(service);
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState(false);

  const start = async () => {
    if (!service) return;
    setStarting(true);
    setFailed(false);
    try {
      await service.create();
    } catch {
      setFailed(true);
    } finally {
      setStarting(false);
    }
  };

  return (
    <Screen title={copy.title} description={copy.body}>
      {party ? (
        <>
          <Text style={styles.body}>
            {party.role === 'creator' ? copy.started : copy.alreadyIn}
          </Text>
          <Button variant="primary" label={copy.continue} onPress={onNext} />
        </>
      ) : (
        <>
          {!service ? <Text style={styles.body}>{copy.needsRadio}</Text> : null}
          {failed ? <Text style={styles.body}>{copy.failed}</Text> : null}
          <Button
            variant="primary"
            label={starting ? copy.starting : copy.start}
            disabled={!service || starting}
            onPress={() => void start()}
          />
          <Button label={radioCopy.pair.setUpLater} onPress={onNext} disabled={starting} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { ...textStyles.bodyLarge, color: colors.textSecondary },
});
