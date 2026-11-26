import { Text } from 'react-native';

import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { SlideToConfirm } from '../../components/SlideToConfirm';
import { HELP_AUDIENCE_TEXT } from '../../domain/audience';
import { memberIdentity } from '../../map/meshMapData';
import { makeStyles, textStyles } from '../../theme';
import { useHelpState, useSafetyRadio } from '../hooks';
import { ASK_FOR_A_HAND, helpProgress } from '../wording';

type Props = { visible: boolean; onClose: () => void };

/**
 * Ask for a Hand: slide to send (no accidental sends), then live progress
 * ("Sent twice…", "Seen by Dale") with a way to stop. Help from your party,
 * not an emergency call.
 */
export function AskForHandSheet({ visible, onClose }: Props) {
  const styles = useStyles();
  const radio = useSafetyRadio();
  const state = useHelpState();
  const audience = radio?.audience ?? 'party';
  const nameOf = (node: number) =>
    memberIdentity(radio?.client.nodes.get(node), node, radio?.names ?? {}).displayName;
  const progress = state ? helpProgress(state, nameOf, audience) : null;

  return (
    <Sheet visible={visible} title={ASK_FOR_A_HAND} onClose={onClose}>
      {progress && state?.status !== 'cancelled' ? (
        <>
          <Text accessibilityLiveRegion="polite" accessibilityRole="header" style={styles.title}>
            {progress.title}
          </Text>
          <Text accessibilityLiveRegion="polite" style={styles.body}>
            {progress.detail}
          </Text>
          {state?.status === 'sending' ? (
            <Button label="I’m OK, stop asking" onPress={() => radio?.help.cancel()} />
          ) : null}
        </>
      ) : (
        <>
          <Text style={styles.body}>
            {HELP_AUDIENCE_TEXT[audience]} with where you are, and keeps trying until someone sees
            it.
          </Text>
          {progress ? <Text style={styles.body}>{progress.detail}</Text> : null}
          <SlideToConfirm
            tone="help"
            label="Slide to ask for a hand"
            onConfirm={() => radio?.help.ask()}
            disabled={!radio}
            disabledReason="Connect your radio to ask for a hand."
          />
        </>
      )}
    </Sheet>
  );
}

const useStyles = makeStyles((theme) => ({
  title: { ...textStyles.sheetTitle, color: theme.colors.warning },
  body: { ...textStyles.bodyLarge, color: theme.colors.text },
}));
