// The name prompt after first run: at the first check-in (with the radio's name as the
// default) and on the Party tab. All on the phone: no account, no network.
import { CheckInMode } from '@huntclub/mesh';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import CheckInTab from '../../app/(tabs)/check-in';
import { CheckInRadioContext } from '../../checkin/CheckInRadio';
import { loadNameSkippedAt, loadProfile, saveProfile } from '../../db/appState';
import { migrate } from '../../db/migrate';
import { migrations } from '../../db/migrations';
import type { SqlDatabase } from '../../db/types';
import { radioCopy } from '../../radio/copy';
import { RadioStatus } from '../../radio/ui/RadioStatus';
import { answerPermissionAlerts } from '../../test-utils/alerts';
import { CHECK_IN_HERE, checkInRadio } from '../../test-utils/checkInFixtures';
import { placePhone } from '../../test-utils/fakeMapLibre';
import { createTestDatabase } from '../../test-utils/nodeSqlite';
import { renderWithRadio } from '../../test-utils/renderWithRadio';
import { nameCopy } from '../copy';
import { YourNameSection } from '../NamePrompt';
import { ProfileProvider } from '../ProfileProvider';

jest.mock(
  'react-native-ble-manager',
  () => jest.requireActual('../../test-utils/fakeBleManager').fakeBleManagerModule,
);
jest.mock(
  '@maplibre/maplibre-react-native',
  () => jest.requireActual('../../test-utils/fakeMapLibre').fakeMapLibreModule,
);

/** RADIO_A, whose owner is "Jake radio" / "JK". */
const REMEMBERED = { peripheralId: 'AA:BB', name: 'Meshtastic 3c4d', pairedAt: 1 };

beforeEach(() => {
  answerPermissionAlerts();
  placePhone(CHECK_IN_HERE);
});

async function database(setUp?: (db: SqlDatabase) => Promise<void>) {
  const db = createTestDatabase();
  await migrate(db, migrations);
  await setUp?.(db);
  return db;
}

/** The Check In tab with a linked radio (for its name) and a party check-in radio. */
async function showCheckIn(db: SqlDatabase) {
  const checkIns = checkInRadio('party');
  await renderWithRadio(
    <ProfileProvider db={db}>
      <RadioStatus />
      <CheckInRadioContext.Provider value={checkIns}>
        <CheckInTab />
      </CheckInRadioContext.Provider>
    </ProfileProvider>,
    { remembered: REMEMBERED },
  );
  // The radio is linked, so its owner name is known.
  expect(await screen.findByText(radioCopy.link.ready)).toBeTruthy();
  return checkIns;
}

async function checkInOnTheMove() {
  await fireEvent.press(screen.getByRole('radio', { name: /^On the move/ }));
  await fireEvent(
    screen.getByRole('button', { name: 'Slide to check in' }),
    'accessibilityAction',
    {
      nativeEvent: { actionName: 'activate' },
    },
  );
}

describe('name prompt at the first check-in', () => {
  it('checks in first, then asks, defaulting to the radio’s name; Save name keeps it', async () => {
    const db = await database();
    const checkIns = await showCheckIn(db);
    expect(screen.queryByText(nameCopy.body)).toBeNull();

    await checkInOnTheMove();
    expect(checkIns.checkIns.checkIn).toHaveBeenCalledWith({ mode: CheckInMode.Moving });
    expect(await screen.findByText(nameCopy.body)).toBeTruthy();
    expect(screen.getByLabelText(nameCopy.nameLabel).props.value).toBe('Jake radio');
    expect(screen.getByLabelText(nameCopy.initialsLabel).props.value).toBe('JK');

    await fireEvent.changeText(screen.getByLabelText(nameCopy.nameLabel), 'Jake Smith');
    await fireEvent.changeText(screen.getByLabelText(nameCopy.initialsLabel), 'js');
    await fireEvent.press(screen.getByRole('button', { name: nameCopy.save }));
    await waitFor(() => expect(screen.queryByText(nameCopy.body)).toBeNull());
    expect(await loadProfile(db)).toEqual({ displayName: 'Jake Smith', initials: 'JS' });
  });

  it('Skip for now is remembered: the next check-in does not ask again', async () => {
    const db = await database();
    await showCheckIn(db);
    await checkInOnTheMove();
    await fireEvent.press(await screen.findByRole('button', { name: nameCopy.skip }));
    await waitFor(() => expect(screen.queryByText(nameCopy.body)).toBeNull());
    expect(await loadNameSkippedAt(db)).not.toBeNull();
    expect(await loadProfile(db)).toBeNull();

    await checkInOnTheMove();
    expect(screen.queryByText(nameCopy.body)).toBeNull();
  });

  it('never asks a hunter who has a name', async () => {
    const db = await database((d) => saveProfile(d, { displayName: 'Sam', initials: 'SM' }));
    await showCheckIn(db);
    await checkInOnTheMove();
    expect(screen.queryByText(nameCopy.body)).toBeNull();
  });
});

describe('Party tab → Your name', () => {
  it('says the radio’s name shows until one is set, then sets it', async () => {
    const db = await database();
    await renderWithRadio(
      <ProfileProvider db={db}>
        <YourNameSection />
      </ProfileProvider>,
    );
    expect(await screen.findByText(nameCopy.section.notSet)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: nameCopy.section.set }));
    // No radio linked here: nothing to default to, and no Skip (Close leaves it as it is).
    expect(screen.getByLabelText(nameCopy.nameLabel).props.value).toBe('');
    expect(screen.queryByRole('button', { name: nameCopy.skip })).toBeNull();

    await fireEvent.changeText(screen.getByLabelText(nameCopy.nameLabel), 'Dale Earl');
    await fireEvent.press(screen.getByRole('button', { name: nameCopy.save }));
    expect(await screen.findByText('Dale Earl (DE)')).toBeTruthy();
    expect(screen.getByRole('button', { name: nameCopy.section.change })).toBeTruthy();
    expect(await loadProfile(db)).toEqual({ displayName: 'Dale Earl', initials: 'DE' });
  });
});
