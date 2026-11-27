// The club plan's maths: a Web Mercator view of the ground (where it is centred and how far
// in), fitting the club's own geometry (property line, areas, stands) into a box of pixels,
// panning and zooming, and the scale bar. Mercator is what the USGS tiles are drawn in, so
// the plan lies exactly on them. Pure, so it is tested without a browser.
import {
  EARTH_CIRCUMFERENCE_METRES,
  mercatorLonLat,
  mercatorXY,
  polygonRings,
  USGS_TILE_SIZE,
  type Bounds,
  type Ring,
} from '@huntclub/shared';

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

/**
 * Where the map looks: the ground at the middle of the box, and how far in, as a tile zoom
 * (fractional; at zoom z the world is 256 * 2^z px across, so one USGS tile is 256 px at a whole z).
 */
export interface View {
  lon: number;
  lat: number;
  zoom: number;
}

/** How far out and in the map goes: a few states across, down to past the deepest USGS level. */
export const VIEW_ZOOM = { min: 3, max: 20 } as const;

/** Where a club with nothing drawn yet starts: the lower 48 states. */
export const DEFAULT_VIEW: View = { lon: -96, lat: 38.5, zoom: 4 };

/**
 * The draw bar along the map's bottom on a phone (PropertyLineEditor): one 48 px row of
 * buttons with 8 px around it. The scale bar, credit and map controls sit above it.
 */
export const DRAW_BAR_HEIGHT = 48 + 2 * 8;

/** How far in "Use my location" goes: a few square miles, enough to find the property. */
export const LOCATION_ZOOM = 14;

export interface Projection {
  /** [x, y] in px from the box's top left. */
  project: (lon: number, lat: number) => [number, number];
  /** The [lon, lat] under a point in px (the inverse of project). */
  unproject: (x: number, y: number) => [number, number];
  /** Metres on the ground per px, at the middle of the view. */
  metresPerPx: number;
  view: View;
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

const worldPx = (zoom: number) => USGS_TILE_SIZE * 2 ** zoom;
const metresPerWorld = (lat: number) =>
  EARTH_CIRCUMFERENCE_METRES * Math.cos((lat * Math.PI) / 180);
const clampZoom = (zoom: number) => Math.min(VIEW_ZOOM.max, Math.max(VIEW_ZOOM.min, zoom));

/** The view's projection onto a `width` by `height` box (north up, the view's middle in the middle). */
export function viewProjection(view: View, width: number, height: number): Projection {
  const scale = worldPx(view.zoom);
  const [cx, cy] = mercatorXY(view.lon, view.lat);
  return {
    view,
    metresPerPx: metresPerWorld(view.lat) / scale,
    project: (lon, lat) => {
      const [x, y] = mercatorXY(lon, lat);
      return [width / 2 + (x - cx) * scale, height / 2 + (y - cy) * scale];
    },
    unproject: (x, y) =>
      mercatorLonLat(cx + (x - width / 2) / scale, cy + (y - height / 2) / scale),
  };
}

/**
 * The view that fits `bounds` into a `width` by `height` box, centred in the space the insets
 * leave (never closer in than VIEW_ZOOM.max).
 */
export function fitView(bounds: Bounds, width: number, height: number, insets: Insets): View {
  const [west, south, east, north] = bounds;
  const [x0, y0] = mercatorXY(west, north);
  const [x1, y1] = mercatorXY(east, south);
  const minSpan = MIN_SPAN_METRES / metresPerWorld(boundsCentre(bounds).lat);
  const spanX = Math.max(x1 - x0, minSpan);
  const spanY = Math.max(y1 - y0, minSpan);
  const roomX = Math.max(1, width - insets.left - insets.right);
  const roomY = Math.max(1, height - insets.top - insets.bottom);
  const zoom = Math.min(
    VIEW_ZOOM.max,
    Math.log2(Math.min(roomX / spanX, roomY / spanY) / USGS_TILE_SIZE),
  );
  const scale = worldPx(zoom);
  // The bounds' middle sits at the room's middle; the view is the box's middle.
  const roomMidX = insets.left + roomX / 2;
  const roomMidY = insets.top + roomY / 2;
  const [lon, lat] = mercatorLonLat(
    (x0 + x1) / 2 + (width / 2 - roomMidX) / scale,
    (y0 + y1) / 2 + (height / 2 - roomMidY) / scale,
  );
  return { lon, lat, zoom };
}

/** Fits `bounds` into the box (fitView), as a projection. */
export function fitPlan(bounds: Bounds, width: number, height: number, insets: Insets): Projection {
  return viewProjection(fitView(bounds, width, height, insets), width, height);
}

/** The view moved so the ground slides `dx`, `dy` px (a drag right moves the ground right). */
export function panView(view: View, dx: number, dy: number): View {
  const scale = worldPx(view.zoom);
  const [x, y] = mercatorXY(view.lon, view.lat);
  const [lon, lat] = mercatorLonLat(
    Math.min(1, Math.max(0, x - dx / scale)),
    Math.min(1, Math.max(0, y - dy / scale)),
  );
  return { ...view, lon, lat };
}

/** The view zoomed by `delta` levels, keeping the ground under `at` (px; default the middle) still. */
export function zoomView(
  view: View,
  delta: number,
  width: number,
  height: number,
  at: [number, number] = [width / 2, height / 2],
): View {
  const zoom = clampZoom(view.zoom + delta);
  const before = viewProjection(view, width, height).unproject(...at);
  const after = viewProjection({ ...view, zoom }, width, height).project(...before);
  return panView({ ...view, zoom }, at[0] - after[0], at[1] - after[1]);
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

/** Room kept between a marker's plate and the map's edge, in px. */
export const PLATE_EDGE_ROOM = 8;

/**
 * Which side of its marker a plate goes: the right, unless it would cross the map's right edge
 * there and fits on the left (a stand on the property's east side).
 */
export function plateSide(
  markerX: number,
  offset: number,
  plateWidth: number,
  mapWidth: number,
): 'right' | 'left' {
  const fitsRight = markerX + offset + plateWidth <= mapWidth - PLATE_EDGE_ROOM;
  if (fitsRight) return 'right';
  const fitsLeft = markerX - offset - plateWidth >= PLATE_EDGE_ROOM;
  if (fitsLeft) return 'left';
  // Neither fits (a very narrow map): the side with more room.
  return markerX > mapWidth / 2 ? 'left' : 'right';
}
