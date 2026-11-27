import {
  bearingDeg,
  boundsAround,
  boundsAroundPoint,
  compassWord,
  destination,
  distanceAndDirection,
  distanceMeters,
  metersPerPoint,
  MILE_M,
  MIN_BOUNDS_SPAN_DEG,
  scaleBar,
  scentConeRing,
  SCENT_CONE,
} from '../geo';

describe('scaleBar', () => {
  it('shows 500 ft at a typical hunting zoom', () => {
    const bar = scaleBar(40.79, 15.5);
    expect(bar.label).toBe('500 ft');
    expect(bar.width).toBeCloseTo((500 * 0.3048) / metersPerPoint(40.79, 15.5), 5);
  });

  it('switches to longer distances when zoomed out', () => {
    expect(scaleBar(40.79, 10).label).toMatch(/mi$/);
  });
});

describe('scent cone', () => {
  const origin = { lat: 40.79, lon: -77.86 };

  it('builds a closed ring that starts at you and reaches downwind', () => {
    const ring = scentConeRing(origin, 270);
    expect(ring[0]).toEqual([origin.lon, origin.lat]);
    expect(ring[ring.length - 1]).toEqual(ring[0]);
    expect(ring).toHaveLength(SCENT_CONE.arcSteps + 3);
    // Every arc point is east of you for a west wind.
    for (const [lon] of ring.slice(1, -1)) expect(lon).toBeGreaterThan(origin.lon);
  });

  it('moves the right distance', () => {
    const north = destination(origin, 0, 1000);
    expect(north.lon).toBeCloseTo(origin.lon, 6);
    expect((north.lat - origin.lat) * 111_195).toBeCloseTo(1000, -1);
  });
});

describe('distanceMeters', () => {
  it('measures great-circle distance', () => {
    const a = { lat: 40.79, lon: -77.86 };
    expect(distanceMeters(a, a)).toBe(0);
    expect(distanceMeters(a, destination(a, 90, 1234))).toBeCloseTo(1234, 3);
  });
});

describe('bearing and direction', () => {
  const a = { lat: 40.79, lon: -77.86 };

  it('names compass directions', () => {
    expect(compassWord(0)).toBe('north');
    expect(compassWord(44)).toBe('northeast');
    expect(compassWord(181)).toBe('south');
    expect(compassWord(350)).toBe('north');
  });

  it('measures bearing and says how far and which way', () => {
    expect(bearingDeg(a, destination(a, 135, 500))).toBeCloseTo(135, 1);
    expect(distanceAndDirection(a, destination(a, 90, 50))).toBe('160 ft east');
    expect(distanceAndDirection(a, destination(a, 270, 3000))).toBe('1.9 mi west');
  });
});

describe('boundsAround', () => {
  it('is undefined with nothing to frame', () => {
    expect(boundsAround([])).toBeUndefined();
  });

  it('frames all points', () => {
    expect(
      boundsAround([
        { lat: 40, lon: -78 },
        { lat: 41, lon: -77 },
      ]),
    ).toEqual([-78, 40, -77, 41]);
  });

  it('keeps a single point at least the minimum span wide and tall', () => {
    const [west, south, east, north] = boundsAround([{ lat: 40, lon: -78 }])!;
    expect(east - west).toBeCloseTo(MIN_BOUNDS_SPAN_DEG);
    expect(north - south).toBeCloseTo(MIN_BOUNDS_SPAN_DEG);
  });
});

describe('boundsAroundPoint', () => {
  it('reaches the radius in every direction', () => {
    const center = { lat: 40.79, lon: -77.86 };
    const [west, south, east, north] = boundsAroundPoint(center, MILE_M);
    for (const corner of [
      { lat: north, lon: center.lon },
      { lat: south, lon: center.lon },
      { lat: center.lat, lon: east },
      { lat: center.lat, lon: west },
    ]) {
      expect(distanceMeters(center, corner)).toBeCloseTo(MILE_M, 0);
    }
  });
});
