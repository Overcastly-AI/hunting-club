import { fireEvent, screen } from '@testing-library/react-native';

import { radioCopy } from '../../radio/copy';
import { renderWithRadio } from '../../test-utils/renderWithRadio';
import { resetBluetoothForTests } from '../../test-utils/resetBluetooth';
import { onboardingCopy } from '../copy';
import { OnboardingScreen } from '../OnboardingScreen';

jest.mock(
  'react-native-ble-manager',
  () => jest.requireActual('../../test-utils/fakeBleManager').fakeBleManagerModule,
);

beforeEach(resetBluetoothForTests);

describe('OnboardingScreen', () => {
  it('welcomes, then offers pairing as step 1; setting it up later finishes', async () => {
    const onFinish = jest.fn();
    await renderWithRadio(<OnboardingScreen onFinish={onFinish} />);

    expect(screen.getByText(onboardingCopy.welcome.title)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: onboardingCopy.welcome.start }));
    expect(screen.getByText(radioCopy.pair.title)).toBeTruthy();
    expect(onFinish).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: radioCopy.pair.setUpLater }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
