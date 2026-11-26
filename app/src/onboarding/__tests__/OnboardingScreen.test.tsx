import { fireEvent, screen } from '@testing-library/react-native';

import { radioCopy } from '../../radio/copy';
import { fakeBle } from '../../test-utils/fakeBleManager';
import { renderWithRadio } from '../../test-utils/renderWithRadio';
import { resetBluetoothForTests } from '../../test-utils/resetBluetooth';
import { onboardingCopy } from '../copy';
import { OnboardingScreen } from '../OnboardingScreen';

jest.mock(
  'react-native-ble-manager',
  () => jest.requireActual('../../test-utils/fakeBleManager').fakeBleManagerModule,
);

beforeEach(resetBluetoothForTests);

async function start() {
  const onFinish = jest.fn();
  await renderWithRadio(<OnboardingScreen onFinish={onFinish} />);
  expect(screen.getByText(onboardingCopy.welcome.title)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: onboardingCopy.welcome.start }));
  expect(screen.getByText(radioCopy.pair.title)).toBeTruthy();
  return onFinish;
}

describe('OnboardingScreen', () => {
  it('welcomes, then pairs a radio as step 1 and finishes on Done', async () => {
    fakeBle.scanResults = [{ id: 'NEAR', rssi: -55, advertising: { localName: 'Near radio' } }];
    const onFinish = await start();

    await fireEvent.press(screen.getByRole('button', { name: radioCopy.pair.findRadios }));
    await fireEvent.press(
      await screen.findByRole('button', {
        name: `${radioCopy.pair.connect} Near radio, ${radioCopy.signal.strong}`,
      }),
    );
    await fireEvent.press(await screen.findByRole('button', { name: radioCopy.pair.done }));

    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('lets the hunter set up the radio later', async () => {
    const onFinish = await start();
    await fireEvent.press(screen.getByRole('button', { name: radioCopy.pair.setUpLater }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
