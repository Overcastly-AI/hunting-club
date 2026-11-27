import {
  COMPASS_POINTS,
  compassPointToDegrees,
  degreesToCompassPoint,
  downwindBearing,
} from '../compass';

describe('compass points', () => {
  it('maps every NWS direction to its bearing and back', () => {
    COMPASS_POINTS.forEach((point, i) => {
      expect(compassPointToDegrees(point)).toBe(i * 22.5);
      expect(degreesToCompassPoint(i * 22.5)).toBe(point);
    });
  });

  it('returns null for the empty direction NWS sends when calm, and for junk', () => {
    expect(compassPointToDegrees('')).toBeNull();
    expect(compassPointToDegrees('VRB')).toBeNull();
  });

  it('rounds any bearing to the nearest point', () => {
    expect(degreesToCompassPoint(359)).toBe('N');
    expect(degreesToCompassPoint(-90)).toBe('W');
    expect(degreesToCompassPoint(34)).toBe('NE');
  });
});

describe('downwindBearing', () => {
  it('points the other way from where the wind blows', () => {
    expect(downwindBearing(270)).toBe(90); // wind from the west blows scent east
    expect(downwindBearing(90)).toBe(270);
    expect(downwindBearing(200)).toBe(20);
    expect(downwindBearing(-90)).toBe(90);
  });
});
