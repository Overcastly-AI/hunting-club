import { MemoryPartyStore, FREE_PARTY_MAX_MEMBERS, type StoredParty } from '@huntclub/core';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithRadio } from '../../test-utils/renderWithRadio';
import { partyCopy } from '../copy';
import { PartyQr } from '../PartyQr';
import { PartyStep } from '../PartyStep';

const REMEMBERED = { peripheralId: 'AA:BB', name: 'Meshtastic 3c4d', pairedAt: 1 };
const copy = partyCopy.qr;

describe('PartyQr', () => {
  it('shows nothing until there is a party, then the Party QR code', async () => {
    await renderWithRadio(
      <>
        <PartyStep onNext={jest.fn()} />
        <PartyQr />
      </>,
      { remembered: REMEMBERED },
    );
    expect(screen.queryByText(copy.title)).toBeNull();

    const start = partyCopy.step.start;
    await waitFor(() => expect(screen.getByRole('button', { name: start })).toBeEnabled());
    await fireEvent.press(screen.getByRole('button', { name: start }));

    expect(await screen.findByLabelText(copy.imageLabel)).toBeTruthy();
    expect(screen.getByText(copy.body)).toBeTruthy();
  });

  it('hides the QR code when the party is full', async () => {
    const full: StoredParty = {
      id: 'p1',
      joinLink: 'not shown when full',
      role: 'creator',
      joinedAt: 1,
      channelIndex: 0,
      members: Array.from({ length: FREE_PARTY_MAX_MEMBERS - 1 }, (_, i) => ({
        node: 100 + i,
        firstHeard: 1,
        lastHeard: 1,
      })),
    };
    await renderWithRadio(<PartyQr />, {
      remembered: REMEMBERED,
      services: { partyStore: new MemoryPartyStore(full) },
    });

    expect(await screen.findByText(copy.full(FREE_PARTY_MAX_MEMBERS))).toBeTruthy();
    expect(screen.queryByLabelText(copy.imageLabel)).toBeNull();
  });
});
