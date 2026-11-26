import { FakeRadio } from '@huntclub/mesh/testing';
import { screen, waitFor } from '@testing-library/react-native';

import type { MyProfile } from '../../db/appState';
import { RADIO_A } from '../../test-utils/radioFixtures';
import { renderWithRadio } from '../../test-utils/renderWithRadio';
import { radioCopy } from '../copy';
import { OwnerSync, ownerToWrite } from '../OwnerSync';
import type { RadioInfo } from '../RadioController';
import { RadioStatus } from '../ui/RadioStatus';

const REMEMBERED = { peripheralId: 'AA:BB', name: 'Meshtastic 3c4d', pairedAt: 1 };
const JAKE: MyProfile = { displayName: 'Jake Smith', initials: 'JS' };
const RADIO: RadioInfo = {
  nodeNum: 1,
  nodeId: '!00000001',
  longName: 'Meshtastic 0001',
  shortName: '0001',
};

const setOwnerWrites = (radio: FakeRadio) =>
  radio.adminLog
    .filter((a) => a.payloadVariant.case === 'setOwner')
    .map((a) => a.payloadVariant.value);

describe('ownerToWrite', () => {
  it('is the profile as the radio owner until the radio carries it', () => {
    expect(ownerToWrite(RADIO, JAKE)).toEqual({ longName: 'Jake Smith', shortName: 'JS' });
    expect(ownerToWrite({ ...RADIO, longName: 'Jake Smith', shortName: 'JS' }, JAKE)).toBeNull();
  });

  it('waits for both a radio and a profile', () => {
    expect(ownerToWrite(null, JAKE)).toBeNull();
    expect(ownerToWrite(RADIO, null)).toBeNull();
    expect(ownerToWrite(RADIO, undefined)).toBeNull();
  });
});

describe('OwnerSync', () => {
  it('writes the hunter’s name to the radio once it is ready, and only once', async () => {
    const radio = new FakeRadio(RADIO_A);
    await renderWithRadio(
      <>
        <RadioStatus />
        <OwnerSync profile={JAKE} />
      </>,
      { radio, remembered: REMEMBERED },
    );

    expect(await screen.findByText(radioCopy.link.ready)).toBeTruthy();
    await waitFor(() =>
      expect(setOwnerWrites(radio)).toEqual([
        expect.objectContaining({ longName: 'Jake Smith', shortName: 'JS' }),
      ]),
    );
    expect(screen.getByText('Jake Smith')).toBeTruthy(); // the status shows the new owner
  });

  it('leaves a radio that already carries the name alone', async () => {
    const radio = new FakeRadio({ ...RADIO_A, longName: 'Jake Smith', shortName: 'JS' });
    await renderWithRadio(
      <>
        <RadioStatus />
        <OwnerSync profile={JAKE} />
      </>,
      { radio, remembered: REMEMBERED },
    );
    expect(await screen.findByText(radioCopy.link.ready)).toBeTruthy();
    expect(setOwnerWrites(radio)).toEqual([]);
  });
});
