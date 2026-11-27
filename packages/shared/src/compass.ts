/**
 * The 16 compass points NWS uses for wind direction, clockwise from north.
 * The only table of them in the repo.
 */
export const COMPASS_POINTS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
] as const;

export type CompassPoint = (typeof COMPASS_POINTS)[number];

const STEP_DEG = 360 / COMPASS_POINTS.length;

/** "NNE" → 22.5. Null for anything that isn't one of the 16 points (NWS sends "" when calm). */
export function compassPointToDegrees(point: string): number | null {
  const index = COMPASS_POINTS.indexOf(point.trim().toUpperCase() as CompassPoint);
  return index < 0 ? null : index * STEP_DEG;
}

/** 22.5 → "NNE"; any bearing, rounded to the nearest point. */
export function degreesToCompassPoint(deg: number): CompassPoint {
  const normalized = ((deg % 360) + 360) % 360;
  return COMPASS_POINTS[Math.round(normalized / STEP_DEG) % COMPASS_POINTS.length]!;
}

/** Wind is reported by where it blows from; scent travels the other way. */
export function downwindBearing(windFromDeg: number): number {
  return (((windFromDeg + 180) % 360) + 360) % 360;
}
