import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { radioCopy } from '../../radio/copy';
import { renderWithRadio } from '../../test-utils/renderWithRadio';
import { partyCopy } from '../copy';
import { PartyStep } from '../PartyStep';

const REMEMBERED = { peripheralId: 'AA:BB', name: 'Meshtastic 3c4d', pairedAt: 1 };
const copy = partyCopy.step;

describe('PartyStep', () => {
  it('starts a party on the connected radio, then continues', async () => {
    const onNext = jest.fn();
    const { radio } = await renderWithRadio(<PartyStep onNext={onNext} />, {
      remembered: REMEMBERED,
    });

    // Enabled once the radio link (and so the party service) is up.
    await screen.findByText(copy.title);
    await waitFor(() => expect(screen.getByRole('button', { name: copy.start })).toBeEnabled());
    await fireEvent.press(screen.getByRole('button', { name: copy.start }));

    expect(await screen.findByText(copy.started)).toBeTruthy();
    expect(radio.adminLog.length).toBeGreaterThan(0); // the radio got the party channel
    await fireEvent.press(screen.getByRole('button', { name: copy.continue }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('without a radio, explains and lets the hunter set it up later', async () => {
    const onNext = jest.fn();
    await renderWithRadio(<PartyStep onNext={onNext} />);

    expect(screen.getByText(copy.needsRadio)).toBeTruthy();
    expect(screen.getByRole('button', { name: copy.start })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: radioCopy.pair.setUpLater }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
