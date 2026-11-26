import type { LatLon } from '@huntclub/mesh';

const EARTH_RADIUS_M = 6_371_008.8;
const EARTH_CIRCUMFERENCE_M = 40_075_016.686;
const DEG = Math.PI / 180;
const FOOT_M = 0.3048;
export const MILE_M = 1609.344;

/** Ground metres per screen point at a MapLibre (512 px based) zoom. */
export function metersPerPoint(lat: number, zoom: number): number {
  return (EARTH_CIRCUMFERENCE_M * Math.cos(lat * DEG)) / (512 * 2 ** zoom);
}

/** Scale bar lengths, shortest first. 500 ft is the spec's default at hunting zooms. */
const SCALE_STEPS = [
  { meters: 100 * FOOT_M, label: '100 ft' },
  { meters: 250 * FOOT_M, label: '250 ft' },
  { meters: 500 * FOOT_M, label: '500 ft' },
  { meters: 1000 * FOOT_M, label: '1000 ft' },
  { meters: 0.5 * MILE_M, label: '½ mi' },
  { meters: MILE_M, label: '1 mi' },
  { meters: 2 * MILE_M, label: '2 mi' },
  { meters: 5 * MILE_M, label: '5 mi' },
  { meters: 10 * MILE_M, label: '10 mi' },
  { meters: 25 * MILE_M, label: '25 mi' },
] as const;

export const SCALE_BAR_MAX_WIDTH = 140;

/** The longest scale step that fits within the max width. */
export function scaleBar(lat: number, zoom: number): { width: number; label: string } {
  const mpp = metersPerPoint(lat, zoom);
  let chosen: (typeof SCALE_STEPS)[number] = SCALE_STEPS[0];
  for (const step of SCALE_STEPS) {
    if (step.meters / mpp <= SCALE_BAR_MAX_WIDTH) chosen = step;
  }
  return { width: chosen.meters / mpp, label: chosen.label };
}

/** The point reached by going `distance` metres from `start` on a compass bearing. */
export function destination(start: LatLon, bearingDeg: number, distance: number): LatLon {
  const d = distance / EARTH_RADIUS_M;
  const theta = bearingDeg * DEG;
  const phi1 = start.lat * DEG;
  const lambda1 = start.lon * DEG;
  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(d) + Math.cos(phi1) * Math.sin(d) * Math.cos(theta),
  );
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(d) * Math.cos(phi1),
      Math.cos(d) - Math.sin(phi1) * Math.sin(phi2),
    );
  return { lat: phi2 / DEG, lon: ((lambda2 / DEG + 540) % 360) - 180 };
}

/** Wind is reported by where it blows from; scent travels the other way. */
export function downwindBearing(windFromDeg: number): number {
  return (((windFromDeg + 180) % 360) + 360) % 360;
}

export const SCENT_CONE = { lengthMeters: 300, halfAngleDeg: 20, arcSteps: 8 } as const;

/** GeoJSON polygon ring ([lon, lat] pairs) for a scent cone from `origin` downwind. */
export function scentConeRing(origin: LatLon, windFromDeg: number): [number, number][] {
  const bearing = downwindBearing(windFromDeg);
  const { lengthMeters, halfAngleDeg, arcSteps } = SCENT_CONE;
  const ring: [number, number][] = [[origin.lon, origin.lat]];
  for (let i = 0; i <= arcSteps; i++) {
    const b = bearing - halfAngleDeg + (2 * halfAngleDeg * i) / arcSteps;
    const p = destination(origin, b, lengthMeters);
    ring.push([p.lon, p.lat]);
  }
  ring.push([origin.lon, origin.lat]);
  return ring;
}

/** Where to place the "Your scent" label: two-thirds of the way along the cone. */
export function scentLabelPosition(origin: LatLon, windFromDeg: number): LatLon {
  return destination(origin, downwindBearing(windFromDeg), (SCENT_CONE.lengthMeters * 2) / 3);
}

/** Great-circle distance between two points in metres. */
export function distanceMeters(a: LatLon, b: LatLon): number {
  const dPhi = (b.lat - a.lat) * DEG;
  const dLambda = (b.lon - a.lon) * DEG;
  const h =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}
