import {
  getPermissionsAsync,
  IosAuthorizationStatus,
  requestPermissionsAsync,
  type NotificationPermissionsStatus,
} from 'expo-notifications';

import { askPermission, type PermissionCopy } from './askPermission';

/**
 * Local notifications only (help requests and overdue alerts raised by the
 * phone itself); there is no push service. iOS and Android 13+ ask the user;
 * older Android grants them at install.
 */
export const NOTIFICATIONS_PERMISSION_COPY: PermissionCopy = {
  askTitle: 'Alerts from your party?',
  askBody:
    'Hunt Club shows an alert when someone in your party or club asks for a hand, or when someone is overdue after dark, even if the app is in the background.',
  deniedTitle: 'Alerts are off',
  deniedBody: 'To get alerts, allow notifications for Hunt Club in your phone’s Settings.',
};

const granted = (status: NotificationPermissionsStatus) =>
  status.granted ||
  status.ios?.status === IosAuthorizationStatus.PROVISIONAL ||
  status.ios?.status === IosAuthorizationStatus.AUTHORIZED;

export function ensureNotificationPermission(): Promise<boolean> {
  return askPermission({
    copy: NOTIFICATIONS_PERMISSION_COPY,
    isGranted: async () => granted(await getPermissionsAsync()),
    request: async () =>
      granted(
        await requestPermissionsAsync({
          ios: { allowAlert: true, allowSound: true, allowBadge: false },
        }),
      ),
  });
}
