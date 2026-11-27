// The property line rule: one source for the club API (which refuses a bad line in the club
// create and update requests, club.ts) and the web admin's draw tool (which says why first).
// A line is a GeoJSON Polygon or MultiPolygon; each outer ring is checked.
import { z } from 'zod';
import { polygonSchema, type Polygon } from './fields';
import { BASEMAP_IDS, estimateClubPack, type Ring } from './maps';

/** Square metres in an acre. */
const SQUARE_METRES_PER_ACRE = 4046.8564224;
/** Metres per degree of latitude (and of longitude at the equator). */
const METRES_PER_DEGREE = 111_320;

export const PROPERTY_LINE_LIMITS = {
  /** Corners in one outer ring. */
  minPoints: 3,
  maxPoints: 500,
  /** Smaller than this is a slip of the mouse, not a hunting property. */
  minAcres: 1,
} as const;

export type PropertyLineProblem =
  'tooFewPoints' | 'tooManyPoints' | 'crosses' | 'tooSmall' | 'tooBig';

/** What the draw tool says, and the club API's refusal message. */
export const PROPERTY_LINE_PROBLEMS: Record<PropertyLineProblem, string> = {
  tooFewPoints: `A property line needs at least ${PROPERTY_LINE_LIMITS.minPoints} corners.`,
  tooManyPoints: `A property line can have up to ${PROPERTY_LINE_LIMITS.maxPoints} corners.`,
  crosses: 'The line crosses itself. Move a corner so the sides do not cross.',
  tooSmall: `The property must be at least ${PROPERTY_LINE_LIMITS.minAcres} acre.`,
  tooBig: 'The property is too big for one map pack. Draw a smaller area.',
};

/** A ring's corners: no closing repeat and no corner twice in a row. */
export function ringCorners(ring: Ring): Ring {
  const corners: Ring = [];
  for (const [lon, lat] of ring) {
    const last = corners[corners.length - 1];
    if (!last || last[0] !== lon || last[1] !== lat) corners.push([lon, lat]);
  }
  const first = corners[0];
  const last = corners[corners.length - 1];
  if (corners.length > 1 && first![0] === last![0] && first![1] === last![1]) corners.pop();
  return corners;
}

/** A closed GeoJSON Polygon of one ring of corners (the first corner repeated last). */
export function propertyLinePolygon(corners: Ring): Polygon {
  return { type: 'Polygon', coordinates: [[...corners, corners[0]!]] };
}

/** The area inside a ring of corners, in acres (flat Earth: true to well under 1% at club size). */
export function ringAcres(corners: Ring): number {
  if (corners.length < 3) return 0;
  const lat0 = corners.reduce((sum, [, lat]) => sum + lat, 0) / corners.length;
  const kx = METRES_PER_DEGREE * Math.cos((lat0 * Math.PI) / 180);
  let twice = 0;
  corners.forEach(([lon, lat], i) => {
    const [nextLon, nextLat] = corners[(i + 1) % corners.length]!;
    twice += lon * kx * (nextLat * METRES_PER_DEGREE) - nextLon * kx * (lat * METRES_PER_DEGREE);
  });
  return Math.abs(twice) / 2 / SQUARE_METRES_PER_ACRE;
}

type Point = readonly [number, number];
const cross = (o: Point, a: Point, b: Point) =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const within = (p: Point, a: Point, b: Point) =>
  Math.min(a[0], b[0]) <= p[0] &&
  p[0] <= Math.max(a[0], b[0]) &&
  Math.min(a[1], b[1]) <= p[1] &&
  p[1] <= Math.max(a[1], b[1]);

/** Whether segments ab and cd touch (crossing, or one end on the other, or overlapping). */
function segmentsTouch(a: Point, b: Point, c: Point, d: Point): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0)))
    return true;
  return (
    (d1 === 0 && within(a, c, d)) ||
    (d2 === 0 && within(b, c, d)) ||
    (d3 === 0 && within(c, a, b)) ||
    (d4 === 0 && within(d, a, b))
  );
}

/** Whether any two sides of a ring of corners cross or touch, other than neighbours at their corner. */
export function ringCrossesItself(corners: Ring): boolean {
  const n = corners.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Neighbouring sides share a corner; that touch is the ring itself.
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      const a = corners[i]!;
      const b = corners[(i + 1) % n]!;
      const c = corners[j]!;
      const d = corners[(j + 1) % n]!;
      if (segmentsTouch(a, b, c, d)) return true;
    }
  }
  // Neighbours folding back onto each other (a spike) overlap along a side.
  return corners.some((corner, i) => {
    const prev = corners[(i + n - 1) % n]!;
    const next = corners[(i + 1) % n]!;
    return cross(prev, corner, next) === 0 && within(next, prev, corner);
  });
}

/** The outer ring of each polygon in a GeoJSON Polygon or MultiPolygon, as corners. */
function outerRings(polygon: { type: string; coordinates: unknown }): Ring[] {
  const isPosition = (v: unknown): v is [number, number] =>
    Array.isArray(v) && typeof v[0] === 'number' && typeof v[1] === 'number';
  const ring = (v: unknown): Ring =>
    Array.isArray(v) ? ringCorners(v.filter(isPosition).map(([lon, lat]) => [lon, lat])) : [];
  const coordinates = Array.isArray(polygon.coordinates) ? polygon.coordinates : [];
  return polygon.type === 'MultiPolygon'
    ? coordinates.map((p: unknown) => ring(Array.isArray(p) ? p[0] : undefined))
    : [ring(coordinates[0])];
}

/** Why a property line is refused, or null when it is a good one. */
export function propertyLineProblem(polygon: {
  type: string;
  coordinates: unknown;
}): PropertyLineProblem | null {
  const rings = outerRings(polygon);
  if (rings.length === 0 || rings.some((r) => r.length < PROPERTY_LINE_LIMITS.minPoints))
    return 'tooFewPoints';
  if (rings.some((r) => r.length > PROPERTY_LINE_LIMITS.maxPoints)) return 'tooManyPoints';
  if (rings.some(ringCrossesItself)) return 'crosses';
  if (rings.reduce((sum, r) => sum + ringAcres(r), 0) < PROPERTY_LINE_LIMITS.minAcres)
    return 'tooSmall';
  // Every basemap's map pack must be buildable: the same size rule the map-pack request uses.
  if (BASEMAP_IDS.some((basemap) => estimateClubPack(polygon, { basemap }).overLimit))
    return 'tooBig';
  return null;
}

/** A property line the club API accepts (club create and update requests). */
export const propertyLineSchema = polygonSchema.superRefine((polygon, ctx) => {
  const problem = propertyLineProblem(polygon);
  if (problem) ctx.addIssue({ code: 'custom', message: PROPERTY_LINE_PROBLEMS[problem] });
});
