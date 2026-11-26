import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { radioCopy } from '../../radio/copy';
import { FAKE_SCAN_LABEL, scanNext } from '../../test-utils/fakeQrScanner';
import { testJoinLink } from '../../test-utils/radioFixtures';
import { renderWithRadio } from '../../test-utils/renderWithRadio';
import { partyCopy } from '../copy';
import { PartyStep } from '../PartyStep';

jest.mock(
  '../../components/QrScanner',
  () => jest.requireActual('../../test-utils/fakeQrScanner').fakeQrScannerModule,
);
jest.mock(
  '../../permissions/camera',
  () => jest.requireActual('../../test-utils/fakeQrScanner').fakeCameraPermissionModule,
);

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

  describe('scanning a code', () => {
    async function scan(link: string) {
      const onNext = jest.fn();
      const { radio } = await renderWithRadio(<PartyStep onNext={onNext} />, {
        remembered: REMEMBERED,
        services: { partyConfig: { discoveryMs: 0 } },
      });
      await waitFor(() => expect(screen.getByRole('button', { name: copy.scan })).toBeEnabled());
      scanNext(link);
      await fireEvent.press(screen.getByRole('button', { name: copy.scan }));
      expect(screen.getByText(partyCopy.scan.hint)).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: FAKE_SCAN_LABEL }));
      return { onNext, radio };
    }

    it('joins the party from a friend’s Party QR code', async () => {
      const { onNext, radio } = await scan(testJoinLink({ kind: 'party', partyId: 'abcdEFGH' }));

      expect(await screen.findByText(copy.joined)).toBeTruthy();
      expect(radio.adminLog.length).toBeGreaterThan(0); // the radio got the party channel
      await fireEvent.press(screen.getByRole('button', { name: copy.continue }));
      expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('explains a Club QR code', async () => {
      await scan(testJoinLink({ kind: 'club', clubId: 'club1', inviteToken: 'tok' }));
      expect(await screen.findByText(partyCopy.scan.clubCode)).toBeTruthy();
    });

    it('explains a code that is not a Hunt Club code', async () => {
      await scan('https://example.com/menu');
      expect(await screen.findByText(partyCopy.scan.notACode)).toBeTruthy();
    });
  });
});
