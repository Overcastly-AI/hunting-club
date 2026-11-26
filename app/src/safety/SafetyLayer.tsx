import { useEffect } from 'react';

import { useNow } from '../hooks/useNow';
import { nodePosition } from '../map/meshMapData';
import { alertStore } from './alertStore';
import { nextUnseen } from './alerts';
import { IncomingAlert } from './components/IncomingAlert';
import { StillOutPrompt } from './components/StillOutPrompt';
import { useIncomingAlerts, useSafetyRadio } from './hooks';
import { connectSafetyAlerts } from './SafetyRadio';

/**
 * Mounted once over the tabs: listens for other hunters' help requests and
 * overdue alerts, shows them full screen on any tab, and shows our own
 * "Still out?" prompt at the deadline.
 */
export function SafetyLayer() {
  const radio = useSafetyRadio();
  const alerts = useIncomingAlerts();
  const now = useNow();

  useEffect(() => (radio ? connectSafetyAlerts(radio, alertStore) : undefined), [radio]);
  useEffect(() => alertStore.expire(now), [now]);

  const mine = radio ? radio.client.nodes.get(radio.client.myNodeNum) : undefined;
  const me = mine ? nodePosition(mine) : undefined;

  return (
    <>
      <IncomingAlert alert={nextUnseen(alerts)} me={me} />
      <StillOutPrompt />
    </>
  );
}
