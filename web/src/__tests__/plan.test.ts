import { EARTH_CIRCUMFERENCE_METRES, STAND_TYPE_ICON_NAMES, STAND_TYPES } from '@huntclub/shared';
import { STAND_ICON_COMPONENTS, standIcon } from '../components/standIcons';
import { SAMPLE_PLAN } from '../map/sampleProperty';
import { boundsCentre, fitPlan, planBounds, ringsLabelPoint, scaleBar } from '../map/plan';

const insets = { top: 0, right: 0, bottom: 0, left: 0 };

describe('the club plan', () => {
  it('bounds everything it draws, or nothing when a club has drawn nothing yet', () => {
    expect(planBounds({ areas: [], stands: [] })).toBeNull();
    expect(planBounds({ areas: [], stands: [{ lat: 40, lon: -90 }] })).toEqual([-90, 40, -90, 40]);
    const [west, south, east, north] = planBounds(SAMPLE_PLAN)!;
    expect([west, south, east, north]).toEqual([-90, 40, -89.981, 40.0145]);
    expect(boundsCentre([west, south, east, north])).toEqual({
      lat: (south + north) / 2,
      lon: (west + east) / 2,
    });
  });

  it('fits the property in the room the plates leave, north up, at one scale both ways', () => {
    const bounds = planBounds(SAMPLE_PLAN)!;
    const room = { top: 200, right: 40, bottom: 40, left: 40 };
    const { project, metresPerPx } = fitPlan(bounds, 1000, 800, room);
    const [west, south, east, north] = bounds;
    const [x0, y0] = project(west, north);
    const [x1, y1] = project(east, south);
    // Inside the room, touching it on the tighter side.
    expect(x0).toBeGreaterThanOrEqual(room.left - 0.01);
    expect(x1).toBeLessThanOrEqual(1000 - room.right + 0.01);
    expect(y0).toBeGreaterThanOrEqual(room.top - 0.01);
    expect(y1).toBeLessThanOrEqual(800 - room.bottom + 0.01);
    expect(Math.min(x0 - room.left, y0 - room.top)).toBeLessThan(0.5);
    // North is up; the same metres per px across and down.
    expect(y0).toBeLessThan(y1);
    const metresPerDegree = EARTH_CIRCUMFERENCE_METRES / 360;
    const metresAcross =
      (east - west) * metresPerDegree * Math.cos((((south + north) / 2) * Math.PI) / 180);
    expect((x1 - x0) * metresPerPx).toBeCloseTo(metresAcross, 1);
    expect((y1 - y0) * metresPerPx).toBeCloseTo((north - south) * metresPerDegree, 1);
  });

  it('shows some ground around a lone stand', () => {
    const { metresPerPx } = fitPlan([-90, 40, -90, 40], 400, 400, insets);
    expect(metresPerPx * 400).toBeCloseTo(400, 6);
  });

  it('names an area at the middle of its north edge', () => {
    const [lon, lat] = ringsLabelPoint([
      [
        [-90, 40],
        [-89.98, 40],
        [-89.98, 40.01],
        [-90, 40],
      ],
    ])!;
    expect(lon).toBeCloseTo(-89.99, 9);
    expect(lat).toBe(40.01);
    expect(ringsLabelPoint([])).toBeNull();
  });

  it('picks the longest round scale bar that fits, in feet then miles', () => {
    const ft = 0.3048;
    expect(scaleBar(1, 200)).toMatchObject({ label: '500 ft' });
    expect(scaleBar(1, 200).px).toBeCloseTo(500 * ft);
    expect(scaleBar(3, 140)).toMatchObject({ label: '1,000 ft' });
    expect(scaleBar(10, 140)).toMatchObject({ label: '½ mi' });
    expect(scaleBar(20, 140)).toMatchObject({ label: '1 mi' });
    expect(scaleBar(50, 140)).toMatchObject({ label: '2 mi' });
    // Never longer than asked, down to the shortest step.
    expect(scaleBar(10, 1).label).toBe('50 ft');
  });
});

describe('stand icons', () => {
  it('draw every stand type with the shared icon name the app uses', () => {
    for (const type of STAND_TYPES) {
      expect(standIcon(type)).toBe(STAND_ICON_COMPONENTS[STAND_TYPE_ICON_NAMES[type]]);
      expect(standIcon(type).displayName).toBe(STAND_TYPE_ICON_NAMES[type]);
    }
  });
});
