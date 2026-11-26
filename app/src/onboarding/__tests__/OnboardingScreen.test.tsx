import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { partyCopy } from '../../party/copy';
import { radioCopy } from '../../radio/copy';
import { renderWithRadio } from '../../test-utils/renderWithRadio';
import { resetBluetoothForTests } from '../../test-utils/resetBluetooth';
import { onboardingCopy } from '../copy';
import { OnboardingScreen } from '../OnboardingScreen';

jest.mock(
  'react-native-ble-manager',
  () => jest.requireActual('../../test-utils/fakeBleManager').fakeBleManagerModule,
);
jest.mock(
  '@maplibre/maplibre-react-native',
  () => jest.requireActual('../../test-utils/fakeMapLibre').fakeMapLibreModule,
);

beforeEach(resetBluetoothForTests);

describe('OnboardingScreen', () => {
  it('welcome → pair your radio, party (set up later) → name → permissions → map (set up later) → finished', async () => {
    const onFinish = jest.fn();
    const onProfile = jest.fn().mockResolvedValue(undefined);
    const onDownloadMap = jest.fn();
    await renderWithRadio(
      <OnboardingScreen onFinish={onFinish} onProfile={onProfile} onDownloadMap={onDownloadMap} />,
    );

    expect(screen.getByText(onboardingCopy.welcome.title)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: onboardingCopy.welcome.start }));

    expect(screen.getByText(radioCopy.pair.title)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: radioCopy.pair.setUpLater }));

    expect(screen.getByText(partyCopy.step.title)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: radioCopy.pair.setUpLater }));

    await fireEvent.changeText(screen.getByLabelText(onboardingCopy.name.nameLabel), 'Jake Smith');
    expect(onFinish).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: onboardingCopy.name.continue }));

    expect(onProfile).toHaveBeenCalledWith({ displayName: 'Jake Smith', initials: 'JS' });

    expect(await screen.findByText(onboardingCopy.permissions.title)).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: onboardingCopy.permissions.continue }),
    );

    expect(await screen.findByText(onboardingCopy.map.title)).toBeTruthy();
    expect(onFinish).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: radioCopy.pair.setUpLater }));
    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
    expect(onDownloadMap).not.toHaveBeenCalled();
  });
});
