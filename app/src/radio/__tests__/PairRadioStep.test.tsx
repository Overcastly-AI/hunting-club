import { fireEvent, screen } from '@testing-library/react-native';

import { fakeBle } from '../../test-utils/fakeBleManager';
import { renderWithRadio } from '../../test-utils/renderWithRadio';
import { resetBluetoothForTests } from '../../test-utils/resetBluetooth';
import { radioCopy } from '../copy';
import { PairRadioStep } from '../ui/PairRadioStep';

jest.mock(
  'react-native-ble-manager',
  () => jest.requireActual('../../test-utils/fakeBleManager').fakeBleManagerModule,
);

beforeEach(resetBluetoothForTests);

async function renderStep() {
  const onNext = jest.fn();
  const onSkip = jest.fn();
  await renderWithRadio(<PairRadioStep onNext={onNext} onSkip={onSkip} />);
  return { onNext, onSkip };
}

describe('PairRadioStep (onboarding step 1)', () => {
  it('moves on after pairing a radio and tapping Done', async () => {
    fakeBle.scanResults = [{ id: 'NEAR', rssi: -55, advertising: { localName: 'Near radio' } }];
    const { onNext, onSkip } = await renderStep();

    await fireEvent.press(screen.getByRole('button', { name: radioCopy.pair.findRadios }));
    await fireEvent.press(
      await screen.findByRole('button', {
        name: `${radioCopy.pair.connect} Near radio, ${radioCopy.signal.strong}`,
      }),
    );
    await fireEvent.press(await screen.findByRole('button', { name: radioCopy.pair.done }));

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('lets the hunter set up the radio later', async () => {
    const { onNext, onSkip } = await renderStep();
    await fireEvent.press(screen.getByRole('button', { name: radioCopy.pair.setUpLater }));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });
});
