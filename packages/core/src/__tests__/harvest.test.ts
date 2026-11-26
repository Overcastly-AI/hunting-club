import {
  AppMessageType,
  CheckInMode,
  HARVEST_SEX_CODES,
  decodeAppMessage,
  encodeAppMessage,
  isWithinBudget,
} from '@huntclub/mesh';
import { harvestShareMessage } from '../harvest';

const base = { id: 0xdeadbeef, sender: 0x12345678, time: 1_790_000_000 };

describe('harvestShareMessage', () => {
  it('carries species, sex and where, and round-trips through the codec', () => {
    const msg = harvestShareMessage(
      {
        species: ' Deer ',
        sex: 'male',
        note: '8 point',
        placement: { mode: CheckInMode.Stand, standId: 7, pin: { lat: 40.79, lon: -77.86 } },
      },
      base,
    );
    expect(msg).toMatchObject({
      species: 'Deer',
      sex: HARVEST_SEX_CODES.male,
      standId: 7,
      note: '8 point',
    });
    const decoded = decodeAppMessage(encodeAppMessage(msg));
    expect(decoded).toMatchObject({
      type: AppMessageType.HarvestShare,
      species: 'Deer',
      note: '8 point',
    });
  });

  it('shortens a long note to fit the 80-byte budget and keeps the species', () => {
    const msg = harvestShareMessage(
      {
        species: 'Turkey',
        sex: 'unknown',
        note: 'Long beard, big spurs, came in silent to the decoy at first light behind the creek',
        placement: { mode: CheckInMode.Moving, pin: { lat: 40.79, lon: -77.86 } },
      },
      base,
    );
    expect(msg.species).toBe('Turkey');
    expect(msg.note?.length).toBeGreaterThan(0);
    expect(msg.note!.length).toBeLessThan(60);
    expect(isWithinBudget(AppMessageType.HarvestShare, encodeAppMessage(msg))).toBe(true);
  });

  it('drops the note when nothing fits and leaves it out when empty', () => {
    expect(
      harvestShareMessage({ species: 'Deer', sex: 'female', note: '   ' }, base).note,
    ).toBeUndefined();
  });
});
