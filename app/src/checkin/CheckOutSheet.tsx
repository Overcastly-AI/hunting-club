import { StyleSheet, Text } from 'react-native';

import { Sheet } from '../components/Sheet';
import { SlideToConfirm } from '../components/SlideToConfirm';
import { colors, textStyles } from '../theme';
import { useCheckInActions, type CheckInRadio } from './CheckInRadio';
import { SendStatusText } from './SendStatusText';

export const SLIDE_TO_CHECK_OUT = 'Slide to check out';

type Props = { radio: CheckInRadio | null; visible: boolean; onClose: () => void };

/** Check Out from the map: the same slide-to-confirm as the Check In tab. */
export function CheckOutSheet({ radio, visible, onClose }: Props) {
  const { checkOut, status } = useCheckInActions(radio);
  return (
    <Sheet visible={visible} title="Check out" onClose={onClose}>
      <Text style={styles.body}>Your party stops seeing where you are once you check out.</Text>
      <SlideToConfirm
        label={SLIDE_TO_CHECK_OUT}
        onConfirm={() => {
          if (checkOut()) onClose();
        }}
        disabled={!radio}
        disabledReason="Connect your radio to check out."
      />
      <SendStatusText status={status} />
    </Sheet>
  );
}

const styles = StyleSheet.create({ body: { ...textStyles.body, color: colors.textSecondary } });
