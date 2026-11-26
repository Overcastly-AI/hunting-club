import { fireEvent, screen, waitFor } from '@testing-library/react-native';

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
  it('welcome → pair your radio (set up later) → name → finished', async () => {
    const onFinish = jest.fn();
    const onProfile = jest.fn().mockResolvedValue(undefined);
    await renderWithRadio(<OnboardingScreen onFinish={onFinish} onProfile={onProfile} />);

    expect(screen.getByText(onboardingCopy.welcome.title)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: onboardingCopy.welcome.start }));

    expect(screen.getByText(radioCopy.pair.title)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: radioCopy.pair.setUpLater }));

    await fireEvent.changeText(screen.getByLabelText(onboardingCopy.name.nameLabel), 'Jake Smith');
    expect(onFinish).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: onboardingCopy.name.continue }));

    expect(onProfile).toHaveBeenCalledWith({ displayName: 'Jake Smith', initials: 'JS' });
    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
  });
});
