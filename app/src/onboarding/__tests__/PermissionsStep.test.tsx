import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { BLUETOOTH_PERMISSION_COPY } from '../../permissions/bluetooth';
import { LOCATION_PERMISSION_COPY } from '../../permissions/location';
import { NOTIFICATIONS_PERMISSION_COPY } from '../../permissions/notifications';
import { answerPermissionAlerts } from '../../test-utils/alerts';
import { placePhone } from '../../test-utils/fakeMapLibre';
import { resetBluetoothForTests } from '../../test-utils/resetBluetooth';
import { onboardingCopy } from '../copy';
import { PermissionsStep } from '../PermissionsStep';

jest.mock(
  '@maplibre/maplibre-react-native',
  () => jest.requireActual('../../test-utils/fakeMapLibre').fakeMapLibreModule,
);
jest.mock(
  'react-native-ble-manager',
  () => jest.requireActual('../../test-utils/fakeBleManager').fakeBleManagerModule,
);
jest.mock(
  'expo-notifications',
  () => jest.requireActual('../../test-utils/fakeNotifications').fakeNotificationsModule,
);

const copy = onboardingCopy.permissions;

beforeEach(() => {
  resetBluetoothForTests();
  answerPermissionAlerts();
  placePhone({ lat: 40.79, lon: -77.86 });
  jest.mocked(getPermissionsAsync).mockResolvedValue({ granted: false } as never);
});

describe('PermissionsStep', () => {
  it('gives each permission its plain-language reason', async () => {
    await render(<PermissionsStep onNext={jest.fn()} />);
    for (const reason of [
      LOCATION_PERMISSION_COPY,
      BLUETOOTH_PERMISSION_COPY,
      NOTIFICATIONS_PERMISSION_COPY,
    ]) {
      expect(screen.getByText(reason.askBody)).toBeTruthy();
    }
  });

  it('asks for each one, shows the outcome, and continues either way', async () => {
    jest.mocked(requestPermissionsAsync).mockResolvedValue({ granted: false } as never);
    const onNext = jest.fn();
    await render(<PermissionsStep onNext={onNext} />);

    await fireEvent.press(screen.getByRole('button', { name: copy.allow.location }));
    await fireEvent.press(screen.getByRole('button', { name: copy.allow.bluetooth }));
    expect(await screen.findAllByText(copy.allowed)).toHaveLength(2);
    expect(screen.queryByRole('button', { name: copy.allow.location })).toBeNull();

    // Alerts refused at the system prompt: say so, keep the button to try again.
    await fireEvent.press(screen.getByRole('button', { name: copy.allow.notifications }));
    expect(await screen.findByText(copy.notAllowed)).toBeTruthy();
    expect(screen.getByRole('button', { name: copy.allow.notifications })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: copy.continue }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
