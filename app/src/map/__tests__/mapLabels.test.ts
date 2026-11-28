// The Map tab's names (docs/DESIGN.md "Map chrome" 8) from the shared rules in
// packages/design: stand names beside their markers, and area names that give way to stands.
import { LABEL_HEIGHT, mapChrome, rectsOverlap, standLabelCandidate } from '@huntclub/design';

import type { ClubArea } from '../../checkin/placement';
import { openStandFixture } from '../../test-utils/mapFixtures';
import { screenPoint, type CameraView } from '../geo';
import { mapLabels } from '../mapLabels';

const SIZE = { width: 390, height: 701 };
const CENTRE = { lat: 40.8, lon: -77.85 };
const view = (zoom: number): CameraView => ({ center: CENTRE, zoom, bearing: 0 });

/** A square area whose north edge runs `northOf` degrees above the map's centre. */
const area = (meshId: number, name: string, northOf: number): ClubArea => {
  const n = CENTRE.lat + northOf;
  const s = n - 0.002;
  const w = CENTRE.lon - 0.001;
  const e = CENTRE.lon + 0.001;
  return {
    meshId,
    name,
    boundary: {
      type: 'Polygon',
      coordinates: [
        [
          [w, n],
          [e, n],
          [e, s],
          [w, s],
          [w, n],
        ],
      ],
    },
  } as ClubArea;
};

/** The stand at the map's centre, and its 48 px target on screen. */
const stand = { ...openStandFixture, position: CENTRE };
const standTarget = (zoom: number) => {
  const { x, y } = screenPoint(stand.position, view(zoom), SIZE);
  return standLabelCandidate(stand, x, y, SIZE.width).marker;
};

describe('mapLabels', () => {
  const deep = mapChrome.labels.minZoom + 1;

  it('names the stands beside their markers, on the right with room there', () => {
    const labels = mapLabels([stand], [], view(deep), SIZE, null);
    expect([...labels.stands]).toEqual([[stand.id, 'right']]);
    expect(mapLabels([stand], [], view(deep - 2), SIZE, null).stands.size).toBe(0);
  });

  it('leaves an area name where it is when no stand is under it', () => {
    // North edge far above the stand: its name sits just inside it, `area.drop` px down.
    const labels = mapLabels([stand], [area(1, 'North 40', 0.001)], view(deep), SIZE, null);
    expect(labels.areas).toEqual([
      expect.objectContaining({ id: '1', text: 'North 40', dy: mapChrome.labels.area.drop }),
    ]);
  });

  it('moves an area name off a stand it would cover, so a tap there lands on the stand', () => {
    // The north edge just above the stand: the name would sit on the stand's marker.
    const zoom = deep;
    const edge = area(2, 'Creek Bottom', 0.00002);
    const [label] = mapLabels([stand], [edge], view(zoom), SIZE, null).areas;
    expect(label).toBeDefined();
    expect(label!.dy).not.toBe(mapChrome.labels.area.drop);
    const point = screenPoint(label!.position, view(zoom), SIZE);
    const height = LABEL_HEIGHT;
    const rect = { x: 0, y: point.y + label!.dy - height / 2, width: SIZE.width, height };
    expect(rectsOverlap(rect, standTarget(zoom))).toBe(false);
  });

  it('shows no area names below zoom 15, and none for areas with no outline on the phone', () => {
    const areas = [area(1, 'North 40', 0.001), { meshId: 3, name: 'No outline' }];
    expect(mapLabels([], areas, view(mapChrome.labels.minZoom - 0.5), SIZE, null).areas).toEqual(
      [],
    );
    expect(mapLabels([], areas, view(deep), SIZE, null).areas.map((a) => a.id)).toEqual(['1']);
  });
});
