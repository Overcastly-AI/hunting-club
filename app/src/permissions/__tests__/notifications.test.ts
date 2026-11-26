import {
  getPermissionsAsync,
  IosAuthorizationStatus,
  requestPermissionsAsync,
  type NotificationPermissionsStatus,
} from 'expo-notifications';
import { Linking } from 'react-native';

import { answerAlerts } from '../../test-utils/alerts';
import { PERMISSION_BUTTONS } from '../askPermission';
import { ensureNotificationPermission, NOTIFICATIONS_PERMISSION_COPY } from '../notifications';

jest.mock('expo-notifications', () => ({
  IosAuthorizationStatus: { NOT_DETERMINED: 0, DENIED: 1, AUTHORIZED: 2, PROVISIONAL: 3 },
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}));

const status = (granted: boolean) => ({ granted }) as NotificationPermissionsStatus;
const get = jest.mocked(getPermissionsAsync);
const request = jest.mocked(requestPermissionsAsync);

beforeEach(() => {
  jest.restoreAllMocks();
  get.mockReset();
  request.mockReset();
  jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
});

describe('ensureNotificationPermission', () => {
  it('skips the explanation when already allowed', async () => {
    get.mockResolvedValue(status(true));
    const alerts = answerAlerts(PERMISSION_BUTTONS.continue);
    await expect(ensureNotificationPermission()).resolves.toBe(true);
    expect(alerts).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it('explains, then asks for alerts and sound only', async () => {
    get.mockResolvedValue(status(false));
    request.mockResolvedValue(status(true));
    const alerts = answerAlerts(PERMISSION_BUTTONS.continue);
    await expect(ensureNotificationPermission()).resolves.toBe(true);
    expect(alerts.mock.calls[0]![0]).toBe(NOTIFICATIONS_PERMISSION_COPY.askTitle);
    expect(request).toHaveBeenCalledWith({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
  });

  it('counts iOS provisional authorization as allowed', async () => {
    get.mockResolvedValue({
      granted: false,
      ios: { status: IosAuthorizationStatus.PROVISIONAL },
    } as NotificationPermissionsStatus);
    await expect(ensureNotificationPermission()).resolves.toBe(true);
  });

  it('offers Settings when refused', async () => {
    get.mockResolvedValue(status(false));
    request.mockResolvedValue(status(false));
    const alerts = answerAlerts((title) =>
      title === NOTIFICATIONS_PERMISSION_COPY.deniedTitle
        ? PERMISSION_BUTTONS.openSettings
        : PERMISSION_BUTTONS.continue,
    );
    await expect(ensureNotificationPermission()).resolves.toBe(false);
    expect(alerts.mock.calls.map((c) => c[0])).toEqual([
      NOTIFICATIONS_PERMISSION_COPY.askTitle,
      NOTIFICATIONS_PERMISSION_COPY.deniedTitle,
    ]);
    expect(Linking.openSettings).toHaveBeenCalled();
  });
});
