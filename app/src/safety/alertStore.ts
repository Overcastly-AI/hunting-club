import { createAlertStore } from './alerts';

/** The app's incoming safety alerts, fed by `connectSafetyAlerts`. */
export const alertStore = createAlertStore();
