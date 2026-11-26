import { CORE_CONFIG } from '@huntclub/core';
import { useContext } from 'react';

import { Button } from '../../components/Button';
import { SlideToConfirm } from '../../components/SlideToConfirm';
import { CheckInRadioContext, useCheckInActions } from '../../checkin/CheckInRadio';
import { SLIDE_TO_CHECK_OUT } from '../../checkin/CheckOutSheet';
import { SendStatusText } from '../../checkin/SendStatusText';
import { useSelfPrompt } from '../hooks';
import { selfPromptText } from '../wording';
import { AlertScreen } from './AlertScreen';

/** Core's prompt at our own deadline: "Still out?" Extend, or slide to check out. */
export function StillOutPrompt() {
  const prompt = useSelfPrompt();
  const checkInRadio = useContext(CheckInRadioContext);
  const { extend, checkOut, status } = useCheckInActions(checkInRadio);
  if (!prompt || !checkInRadio) return null;
  const minutes = CORE_CONFIG.overdue.extendMinutes;
  return (
    <AlertScreen
      visible
      title="Still out?"
      detail={selfPromptText(prompt, checkInRadio.graceMinutes, checkInRadio.audience)}
    >
      <Button variant="primary" label={`Extend ${minutes} min`} onPress={() => void extend()} />
      <SlideToConfirm label={SLIDE_TO_CHECK_OUT} onConfirm={() => void checkOut()} />
      <SendStatusText status={status} />
    </AlertScreen>
  );
}
