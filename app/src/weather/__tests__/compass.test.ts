import { COMPASS_POINTS, compassPointToDegrees, degreesToCompassPoint } from '../compass';

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
