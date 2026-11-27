// The club plan's maths: fitting the club's own geometry (property line, areas, stands) into a
// box of pixels, and the scale bar. Pure, so it is tested without a browser. A club is a few
// hundred acres, so a flat projection (longitude shrunk by the cosine of the latitude) is
// true to well under a pixel.
import { polygonRings, type Bounds, type Ring } from '@huntclub/shared';

/** Metres per degree of latitude (and of longitude at the equator). */
const METRES_PER_DEGREE = 111_320;
const FEET_PER_METRE = 3.28084;
const FEET_PER_MILE = 5280;

/** What the plan draws: the property line, areas and stands, in [lon, lat]. */
export interface PlanGeometry {
  boundary?: { coordinates: unknown } | undefined;
  areas: readonly { boundary: { coordinates: unknown } }[];
  stands: readonly { lat: number; lon: number }[];
}

/** Space kept clear on each side, in px: plates float there over the map. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Projection {
  /** [x, y] in px from the box's top left. */
  project: (lon: number, lat: number) => [number, number];
  /** Metres on the ground per px. */
  metresPerPx: number;
}

/** Every point the plan draws, or none (a club with no property line, areas or stands yet). */
export function planBounds(geometry: PlanGeometry): Bounds | null {
  const points: [number, number][] = [
    ...(geometry.boundary ? polygonRings(geometry.boundary).flat() : []),
    ...geometry.areas.flatMap((a) => polygonRings(a.boundary).flat()),
    ...geometry.stands.map((s): [number, number] => [s.lon, s.lat]),
  ];
  if (points.length === 0) return null;
  const lons = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

/** The middle of a box: where sunrise and sunset are worked out for the club. */
export const boundsCentre = ([west, south, east, north]: Bounds) => ({
  lat: (south + north) / 2,
  lon: (west + east) / 2,
});

/** A lone stand has no extent: show at least this much ground around it, in metres. */
const MIN_SPAN_METRES = 400;

/**
 * Fits `bounds` into a `width` by `height` box, centred in the space the insets leave, at the
 * same scale both ways (north up).
 */
export function fitPlan(bounds: Bounds, width: number, height: number, insets: Insets): Projection {
  const [west, south, east, north] = bounds;
  const { lat: midLat, lon: midLon } = boundsCentre(bounds);
  const lonMetres = METRES_PER_DEGREE * Math.cos((midLat * Math.PI) / 180);
  const spanX = Math.max((east - west) * lonMetres, MIN_SPAN_METRES);
  const spanY = Math.max((north - south) * METRES_PER_DEGREE, MIN_SPAN_METRES);
  const roomX = Math.max(1, width - insets.left - insets.right);
  const roomY = Math.max(1, height - insets.top - insets.bottom);
  const metresPerPx = Math.max(spanX / roomX, spanY / roomY);
  const cx = insets.left + roomX / 2;
  const cy = insets.top + roomY / 2;
  return {
    metresPerPx,
    project: (lon, lat) => [
      cx + ((lon - midLon) * lonMetres) / metresPerPx,
      cy - ((lat - midLat) * METRES_PER_DEGREE) / metresPerPx,
    ],
  };
}

/** An SVG path for rings of [lon, lat] points. */
export function ringsPath(rings: readonly Ring[], projection: Projection): string {
  return rings
    .map(
      (ring) =>
        ring
          .map(([lon, lat], i) => {
            const [x, y] = projection.project(lon, lat);
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
          })
          .join(' ') + ' Z',
    )
    .join(' ');
}

/**
 * Where a polygon's name goes: the middle of its north edge (the caller sets it just inside),
 * so stands, usually inside an area, never sit on it.
 */
export function ringsLabelPoint(rings: readonly Ring[]): [number, number] | null {
  const points = rings[0];
  if (!points || points.length === 0) return null;
  const lons = points.map((p) => p[0]);
  const north = Math.max(...points.map((p) => p[1]));
  return [(Math.min(...lons) + Math.max(...lons)) / 2, north];
}

/** Scale bar lengths a hunter reads at a glance, in feet (US clubs). */
const SCALE_STEPS_FEET = [
  50,
  100,
  200,
  500,
  1000,
  2000,
  FEET_PER_MILE / 2,
  FEET_PER_MILE,
  2 * FEET_PER_MILE,
  5 * FEET_PER_MILE,
];

export interface ScaleBar {
  /** Length on screen, in px. */
  px: number;
  /** Length on the ground, in metres (the grid's spacing too). */
  metres: number;
  /** "500 ft", "½ mi", "1 mi". */
  label: string;
}

const feetLabel = (feet: number) => {
  if (feet < FEET_PER_MILE / 2) return `${feet.toLocaleString('en-US')} ft`;
  if (feet === FEET_PER_MILE / 2) return '½ mi';
  return `${feet / FEET_PER_MILE} mi`;
};

/** The longest round length that fits in `maxPx`. */
export function scaleBar(metresPerPx: number, maxPx: number): ScaleBar {
  const fits = (feet: number) => feet / FEET_PER_METRE / metresPerPx <= maxPx;
  const feet = [...SCALE_STEPS_FEET].reverse().find(fits) ?? SCALE_STEPS_FEET[0]!;
  const metres = feet / FEET_PER_METRE;
  return { px: metres / metresPerPx, metres, label: feetLabel(feet) };
}
