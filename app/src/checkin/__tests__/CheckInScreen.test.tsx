// The Check In tab in the map-first design: the four modes, stands nearest first, the overdue
// line (sunset plus grace) and the slider.
import { CheckInMode } from '@huntclub/mesh';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { answerPermissionAlerts } from '../../test-utils/alerts';
import { CHECK_IN_HERE, checkInRadio } from '../../test-utils/checkInFixtures';
import { placePhone } from '../../test-utils/fakeMapLibre';
import { CheckInRadioContext, type CheckInRadio } from '../CheckInRadio';
import { CheckInScreen, WHERE_ARE_YOU_HUNTING, slideLabel } from '../CheckInScreen';
import { STANDS_NEAREST_FIRST } from '../StandList';

jest.mock(
  '@maplibre/maplibre-react-native',
  () => jest.requireActual('../../test-utils/fakeMapLibre').fakeMapLibreModule,
);

beforeEach(() => {
  answerPermissionAlerts();
  placePhone(CHECK_IN_HERE);
});

async function show(radio: CheckInRadio) {
  await render(
    <CheckInRadioContext.Provider value={radio}>
      <CheckInScreen />
    </CheckInRadioContext.Provider>,
  );
  await screen.findByText(WHERE_ARE_YOU_HUNTING);
}

const modeNames = () => screen.getAllByRole('radio').map((node) => node.props.accessibilityLabel);

describe('Check In modes', () => {
  it('offers a club At a stand, In an area, Right here and On the move, stand first', async () => {
    await show(checkInRadio('club'));
    // The four modes, then (At a stand is picked) the stands.
    expect(
      modeNames()
        .slice(0, 4)
        .map((label: string) => label.split('.')[0]),
    ).toEqual(['At a stand', 'In an area', 'Right here', 'On the move']);
    expect(screen.getByRole('radio', { name: /^At a stand/ })).toBeSelected();
  });

  it('needs no stand: a free party gets Right here and On the move', async () => {
    await show(checkInRadio('party'));
    expect(modeNames().map((label: string) => label.split('.')[0])).toEqual([
      'Right here',
      'On the move',
    ]);
    expect(screen.queryByText(STANDS_NEAREST_FIRST)).toBeNull();
  });

  it('lists the stands nearest first, taken ones last, with how far each is', async () => {
    await show(checkInRadio('club'));
    await fireEvent.press(screen.getByRole('radio', { name: /^At a stand/ }));
    await screen.findByText('0.2 mi');
    expect(screen.getByText(STANDS_NEAREST_FIRST)).toBeTruthy();
    const stands = modeNames().slice(4);
    expect(stands).toEqual([
      'Oak Ridge. Ladder stand, available, 0.2 mi away',
      'Pond Box. Ground blind, available, 0.3 mi away',
      'Creek Stand. Dale B. is here, 730 ft away',
    ]);
    expect(screen.getByRole('radio', { name: /^Creek Stand/ })).toBeDisabled();
  });

  it('names the stand on the slider once one is picked, and checks in there', async () => {
    const radio = checkInRadio('club');
    await show(radio);
    await fireEvent.press(screen.getByRole('radio', { name: /^At a stand/ }));
    await fireEvent.press(await screen.findByRole('radio', { name: /^Oak Ridge/ }));
    const slider = screen.getByRole('button', { name: 'Slide to check in at Oak Ridge' });
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(radio.checkIns.checkIn).toHaveBeenCalledWith(
      expect.objectContaining({ mode: CheckInMode.Stand, standId: 1 }),
    );
  });

  it('checks in on the move with no stand and no location', async () => {
    const radio = checkInRadio('party');
    await show(radio);
    await fireEvent.press(screen.getByRole('radio', { name: /^On the move/ }));
    expect(screen.getByText('Walking, stalking or on a drive')).toBeTruthy();
    const slider = screen.getByRole('button', { name: 'Slide to check in' });
    expect(slider).not.toBeDisabled();
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(radio.checkIns.checkIn).toHaveBeenCalledWith({ mode: CheckInMode.Moving });
  });

  it('asks to name a spot right here', async () => {
    await show(checkInRadio('party'));
    await fireEvent.press(screen.getByRole('radio', { name: /^Right here/ }));
    expect(screen.getByLabelText('Name this spot (optional)')).toBeTruthy();
  });

  it('says when the overdue alert goes out: sunset plus the grace time, never shooting hours', async () => {
    await show(checkInRadio('club'));
    await fireEvent.press(screen.getByRole('radio', { name: /^At a stand/ }));
    const line = await screen.findByText(/That is sunset plus 30 minutes\.$/);
    expect(line).toBeTruthy();
    expect(screen.getByText(/^\d{1,2}:\d{2} [AP]M$/)).toBeTruthy();
    expect(screen.queryByText(/shooting|legal|first light|last light/i)).toBeNull();
  });
});

describe('slideLabel', () => {
  it('names the place, or says plainly what the slide does', () => {
    expect(slideLabel(false, 'Oak Ridge')).toBe('Slide to check in at Oak Ridge');
    expect(slideLabel(false, null)).toBe('Slide to check in');
    expect(slideLabel(true, 'Oak Ridge')).toBe('Slide to change mode');
  });
});
