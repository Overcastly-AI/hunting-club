import type { LatLon } from '@huntclub/mesh';
import { router } from 'expo-router';

import { Button } from '../../components/Button';
import { QUICK_REPLIES } from '../../domain/quickReplies';
import { alertStore } from '../alertStore';
import type { IncomingAlert as Alert } from '../alerts';
import { useSafetyRadio } from '../hooks';
import { incomingAlertText } from '../wording';
import { AlertScreen } from './AlertScreen';

type Props = { alert: Alert | undefined; me: LatLon | undefined };

/** Another hunter asked for a hand or is overdue: who, where, and "On my way". */
export function IncomingAlert({ alert, me }: Props) {
  const radio = useSafetyRadio();
  if (!alert) return null;
  const { title, detail } = incomingAlertText(alert, me);
  const close = () => alertStore.markSeen(alert.key);
  const showOnMap = () => {
    close();
    router.navigate('/');
  };
  return (
    <AlertScreen visible title={title} detail={alert.note ? `${detail}\n“${alert.note}”` : detail}>
      {alert.kind === 'help' ? (
        <Button
          variant="primary"
          label="On my way"
          detail={`Sends “${QUICK_REPLIES.comingToYou}”`}
          onPress={() => {
            radio?.client.sendText(QUICK_REPLIES.comingToYou);
            showOnMap();
          }}
        />
      ) : null}
      <Button label="Show on map" onPress={showOnMap} />
      <Button label="Close" onPress={close} />
    </AlertScreen>
  );
}
