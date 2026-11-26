import { MINUTE_MS } from '../../domain/time';
import { NOW } from '../../test-utils/mapFixtures';
import { describeMeshStatus } from '../meshStatus';

describe('describeMeshStatus', () => {
  it('matches the spec example', () => {
    expect(
      describeMeshStatus({ radioConnected: true, radioCount: 3, lastHeardAt: NOW - 12_000 }, NOW),
    ).toEqual({
      text: 'Mesh: 3 radios · heard 12s ago',
      tone: 'ok',
    });
  });

  it('says plainly when the mesh has gone quiet', () => {
    expect(
      describeMeshStatus(
        { radioConnected: true, radioCount: 2, lastHeardAt: NOW - 15 * MINUTE_MS },
        NOW,
      ),
    ).toEqual({ text: 'No radios heard for 15 min', tone: 'quiet' });
  });

  it('handles no radio and nothing heard yet', () => {
    expect(
      describeMeshStatus({ radioConnected: false, radioCount: 0, lastHeardAt: null }, NOW).text,
    ).toBe('No radio connected');
    expect(
      describeMeshStatus({ radioConnected: true, radioCount: 0, lastHeardAt: null }, NOW).text,
    ).toBe('Mesh: no radios heard yet');
  });

  it('uses the singular for one radio', () => {
    expect(
      describeMeshStatus(
        { radioConnected: true, radioCount: 1, lastHeardAt: NOW - 3 * MINUTE_MS },
        NOW,
      ).text,
    ).toBe('Mesh: 1 radio · heard 3 min ago');
  });
});
