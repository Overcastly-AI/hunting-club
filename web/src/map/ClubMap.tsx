// The club plan: the club's own property line, areas and stands, for the admin pages where the
// map is the page (docs/DESIGN.md "The map is the page"). Under it, the club's own map pack when
// one is ready (basemap.ts: read from the admin's own origin, never an outside tile host);
// otherwise a plain ground, since the admin works offline from what it last loaded. It draws
// only real geometry: nothing here is decoration or a sample unless the caller says so.
// Everything is SVG with classes, so the CSP needs no inline styles.
import {
  breakpoints,
  fontSize,
  fontWidth,
  radii,
  sizes,
  space,
  type FontWidth,
} from '@huntclub/design';
import { polygonRings, type StandType } from '@huntclub/shared';
import { MapPinOff, type LucideIcon } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { EmptyState } from '../components/ui';
import { standIcon } from '../components/standIcons';
import { useElementSize, type Size } from '../components/useElementSize';
import { cx } from '../components/ui/cx';
import { STAND_STATUS_LABELS } from '../format';
import type { BasemapPicture } from './basemap';
import {
  fitPlan,
  plateSide,
  planBounds,
  ringsLabelPoint,
  ringsPath,
  scaleBar,
  type Insets,
  type PlanGeometry,
  type Projection,
} from './plan';

export interface PlanStand {
  id: string;
  name: string;
  type: StandType;
  lat: number;
  lon: number;
  active: boolean;
}

export interface PlanArea {
  id: string;
  name: string;
  boundary: { coordinates: unknown };
}

/** What the map says when there is nothing to draw: the EmptyState pattern on a plate. */
export interface MapEmpty {
  /** Default: a map pin crossed out. */
  icon?: LucideIcon;
  title: string;
  line: string;
  action?: ReactNode;
}

/** Until the box is measured (and in tests): a desktop map's size. */
const FALLBACK_SIZE = { width: 960, height: 640 };
/** Ground kept around everything the plan draws, in px: it fits to its bounds with this padding. */
export const FIT_PADDING = space[12];
const EDGE = FIT_PADDING;
/** An area's name sits this far inside its north edge, in px. */
const AREA_LABEL_DROP = 20;
/** The scale bar's longest length, in px. */
const SCALE_MAX_PX = 140;
/** Stand marker, icon and plate geometry (packages/design sizes and radii). */
const STAND = sizes.standMarker;
const ICON = sizes.icon;
const PLATE_PAD = 8;
const PLATE_GAP = 6;
const PLATE_LINE = { name: fontSize.markerName, detail: fontSize.mapLabelMin };
const PLATE_HEIGHT = PLATE_LINE.name + PLATE_LINE.detail + 2 * PLATE_PAD + 4;

/**
 * Archivo's average advance width at bold weights, as a share of the font size; with the
 * width axis it sizes a plate to its words (SVG text has no layout of its own).
 */
const AVERAGE_ADVANCE = 0.56;
const textWidth = (text: string, size: number, width: FontWidth) =>
  text.length * size * AVERAGE_ADVANCE * (width / 100);

export function ClubMap(props: {
  boundary?: PlanGeometry['boundary'];
  areas: readonly PlanArea[];
  stands: readonly PlanStand[];
  /** What the picture shows, for screen readers (the lists on the page carry the detail). */
  label: string;
  /** Room kept clear for plates floating over the map, in px (or worked out from the map's size). */
  insets?: Partial<Insets> | ((size: Size) => Partial<Insets>);
  /** Hide the stands' name plates and the areas' names (the small maps beside a list). */
  compact?: boolean;
  /** The club's own map pack under the plan (null: the plain ground). */
  basemap?: BasemapPicture | null;
  className?: string;
  /** Plates floating over the map. */
  children?: ReactNode;
  /** Shown over the ground when there is nothing to draw yet (null: nothing, e.g. still loading). */
  empty?: MapEmpty | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const size = useElementSize(box, FALLBACK_SIZE);
  const { width, height } = size;
  const compact = props.compact ?? false;
  // Under the tablet width stand names stay, but area names would sit on the stands.
  const areaNames = !compact && width >= breakpoints.tablet;
  const bounds = planBounds(props);
  const insets: Insets = {
    top: EDGE,
    right: EDGE,
    bottom: EDGE,
    left: EDGE,
    ...(typeof props.insets === 'function' ? props.insets(size) : props.insets),
  };
  const projection = bounds ? fitPlan(bounds, width, height, insets) : null;

  return (
    <div ref={box} className={cx('plan', props.className)}>
      <svg
        className="plan__svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={props.label}
      >
        <rect className="plan__ground" width={width} height={height} />
        {projection ? (
          <Drawing
            {...props}
            compact={compact}
            areaNames={areaNames}
            projection={projection}
            width={width}
            height={height}
          />
        ) : null}
      </svg>
      {props.children}
      {/* After the plates, so its heading follows the page's own in the outline. */}
      {projection || !props.empty ? null : <MapEmptyPlate {...props.empty} />}
    </div>
  );
}

function MapEmptyPlate(props: MapEmpty) {
  return (
    <div className="plan__empty">
      <EmptyState
        icon={props.icon ?? MapPinOff}
        title={props.title}
        titleAs="h3"
        action={props.action}
      >
        {props.line}
      </EmptyState>
    </div>
  );
}

function Drawing(
  props: Parameters<typeof ClubMap>[0] & {
    projection: Projection;
    width: number;
    height: number;
    compact: boolean;
    areaNames: boolean;
  },
) {
  const { projection, width, height, compact } = props;
  const scale = scaleBar(projection.metresPerPx, SCALE_MAX_PX);
  const boundary = props.boundary ? polygonRings(props.boundary) : [];
  const basemap = props.basemap;
  return (
    <g aria-hidden="true">
      {basemap ? (
        <Basemap picture={basemap} projection={projection} />
      ) : (
        <Grid step={scale.px} origin={projection.project(0, 0)} width={width} height={height} />
      )}
      {props.areas.map((area) => (
        <path
          key={area.id}
          className="plan__area"
          d={ringsPath(polygonRings(area.boundary), projection)}
        />
      ))}
      {boundary.length > 0 ? (
        <>
          <path className="plan__line" d={ringsPath(boundary, projection)} />
          <path className="plan__line-inner" d={ringsPath(boundary, projection)} />
        </>
      ) : null}
      {/* Small maps leave names to the lists beside them: labels would sit on the stands. */}
      {!props.areaNames
        ? null
        : props.areas.map((area) => {
            const at = ringsLabelPoint(polygonRings(area.boundary));
            if (!at) return null;
            const [x, y] = projection.project(...at);
            return (
              <text
                key={area.id}
                className="plan__label"
                x={x}
                y={y + AREA_LABEL_DROP}
                textAnchor="middle"
              >
                {area.name}
              </text>
            );
          })}
      {props.stands.map((stand) => (
        <Stand
          key={stand.id}
          stand={stand}
          at={projection.project(stand.lon, stand.lat)}
          compact={compact}
          mapWidth={width}
        />
      ))}
      <g transform={`translate(${EDGE / 2} ${height - EDGE / 2})`} className="plan__scale">
        <path className="plan__scale-bar" d={`M0 -8 V0 H${scale.px.toFixed(1)} V-8`} />
        <text className="plan__scale-label" x={scale.px / 2} y={-6} textAnchor="middle">
          {scale.label}
        </text>
      </g>
      {basemap ? (
        <text className="plan__credit" x={width - EDGE / 2} y={height - EDGE / 2} textAnchor="end">
          {basemap.basemap.credit}
        </text>
      ) : null}
    </g>
  );
}

/** The club's map pack: each tile laid where it lies on the ground. */
function Basemap(props: { picture: BasemapPicture; projection: Projection }) {
  return (
    <g className="plan__basemap">
      {props.picture.tiles.map((tile) => {
        const [west, south, east, north] = tile.bounds;
        const [x0, y0] = props.projection.project(west, north);
        const [x1, y1] = props.projection.project(east, south);
        return (
          <image
            key={tile.key}
            href={tile.href}
            x={x0}
            y={y0}
            // A hair over, so no seam shows between neighbouring tiles.
            width={x1 - x0 + 0.5}
            height={y1 - y0 + 0.5}
            preserveAspectRatio="none"
          />
        );
      })}
    </g>
  );
}

/** Faint lines one scale-bar length apart, so distance reads anywhere on the plan. */
function Grid(props: { step: number; origin: [number, number]; width: number; height: number }) {
  const { step, width, height } = props;
  if (!(step > 8)) return null;
  const offset = (o: number) => ((o % step) + step) % step;
  const xs: number[] = [];
  for (let x = offset(props.origin[0]); x < width; x += step) xs.push(x);
  const ys: number[] = [];
  for (let y = offset(props.origin[1]); y < height; y += step) ys.push(y);
  return (
    <path
      className="plan__grid"
      d={[
        ...xs.map((x) => `M${x.toFixed(1)} 0 V${height}`),
        ...ys.map((y) => `M0 ${y.toFixed(1)} H${width}`),
      ].join(' ')}
    />
  );
}

/** A stand: the rounded square with its type's icon, and its plate (name; Open or Closed). */
function Stand(props: {
  stand: PlanStand;
  at: [number, number];
  compact?: boolean | undefined;
  mapWidth: number;
}) {
  const { stand } = props;
  const [x, y] = props.at;
  const Icon = standIcon(stand.type);
  const status = STAND_STATUS_LABELS[stand.active ? 'open' : 'closed'];
  const plateWidth =
    2 * PLATE_PAD +
    Math.max(
      textWidth(stand.name, PLATE_LINE.name, fontWidth.marker),
      textWidth(status, PLATE_LINE.detail, fontWidth.markerDetail),
    );
  // Right of the stand, or left of it where the right would run off the map.
  const side = plateSide(x, STAND / 2 + PLATE_GAP, plateWidth, props.mapWidth);
  const plateX = side === 'right' ? STAND / 2 + PLATE_GAP : -(STAND / 2 + PLATE_GAP + plateWidth);
  return (
    <g
      transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
      className={cx('plan__stand', !stand.active && 'plan__stand--closed')}
    >
      <rect
        className="plan__stand-box"
        x={-STAND / 2}
        y={-STAND / 2}
        width={STAND}
        height={STAND}
        rx={radii.standMarker}
      />
      <Icon x={-ICON / 2} y={-ICON / 2} size={ICON} className="plan__stand-icon" />
      {props.compact ? null : (
        <g
          transform={`translate(${plateX.toFixed(1)} ${-PLATE_HEIGHT / 2})`}
          className={`plan__plate-group plan__plate-group--${side}`}
        >
          <rect
            className="plan__plate"
            width={plateWidth}
            height={PLATE_HEIGHT}
            rx={radii.markerPlate}
          />
          <text className="plan__plate-name" x={PLATE_PAD} y={PLATE_PAD + PLATE_LINE.name - 2}>
            {stand.name}
          </text>
          <text
            className={cx('plan__plate-detail', stand.active && 'plan__plate-detail--open')}
            x={PLATE_PAD}
            y={PLATE_HEIGHT - PLATE_PAD - 1}
          >
            {status}
          </text>
        </g>
      )}
    </g>
  );
}
