// The Map layers sheet's line about the club's downloaded map pack.
import { formatShortDate } from '@huntclub/shared';
import { clubPackText } from '../components/LayersSheet';
import { formatBytes } from '../tiles';

it('says when the club map was downloaded and how big it is', () => {
  const downloadedAt = Date.parse('2026-11-26T12:00:00Z');
  const pack = {
    clubId: 'c1',
    source: 'usgs-topo',
    packId: 'p1',
    bounds: [-94.1, 45.9, -93.9, 46.1] as [number, number, number, number],
    minZoom: 10,
    maxZoom: 16,
    sizeBytes: 48_000_000,
    builtAt: '2026-11-20T08:00:00.000Z',
    localUri: 'file:///p1.pmtiles',
    downloadedAt,
  };
  expect(clubPackText(pack)).toBe(
    `Club map: downloaded ${formatShortDate(new Date(downloadedAt))}, ${formatBytes(48_000_000)}`,
  );
});
