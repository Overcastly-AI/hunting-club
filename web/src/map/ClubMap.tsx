// The club plan: the club's own property line, areas and stands drawn over a plain ground, for
// the admin pages where the map is the page (docs/DESIGN.md "The map is the page"). The web has
// no imagery (the CSP allows no outside images, and the admin works offline from what it last
// loaded), so it draws only real geometry: nothing here is decoration or a sample unless the
// caller says so. Everything is SVG with classes, so the CSP needs no inline styles.
import { breakpoints, fontSize, fontWidth, radii, sizes, type FontWidth } from '@huntclub/design';
import { polygonRings, type StandType } from '@huntclub/shared';
import { useRef, type ReactNode } from 'react';
import { standIcon } from '../components/standIcons';
import { useElementSize, type Size } from '../components/useElementSize';
import { cx } from '../components/ui/cx';
import { STAND_STATUS_LABELS } from '../format';
import {
  fitPlan,
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

/** Until the box is measured (and in tests): a desktop map's size. */
const FALLBACK_SIZE = { width: 960, height: 640 };
/** Ground kept around the property, in px. */
const EDGE = 40;
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
  /** Hide the stands' name plates (small maps; always under the tablet width). */
  compact?: boolean;
  className?: string;
  /** Plates floating over the map. */
  children?: ReactNode;
  /** Shown over the ground when there is nothing to draw yet. */
  empty?: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const size = useElementSize(box, FALLBACK_SIZE);
  const { width, height } = size;
  const compact = props.compact || width < breakpoints.tablet;
  const bounds = planBounds(props);
  const insets: Insets = {
    top: EDGE,
    right: EDGE,
    bottom: EDGE,
    left: EDGE,
    ...(typeof props.insets === 'function' ? props.insets(size) : props.insets),
  };
  // Room on the right for the plate of a stand on the property's east edge.
  if (!compact) insets.right += STAND / 2;
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
            projection={projection}
            width={width}
            height={height}
          />
        ) : null}
      </svg>
      {projection ? null : props.empty}
      {props.children}
    </div>
  );
}

function Drawing(
  props: Parameters<typeof ClubMap>[0] & { projection: Projection; width: number; height: number },
) {
  const { projection, width, height } = props;
  const scale = scaleBar(projection.metresPerPx, SCALE_MAX_PX);
  const boundary = props.boundary ? polygonRings(props.boundary) : [];
  return (
    <g aria-hidden="true">
      <Grid step={scale.px} origin={projection.project(0, 0)} width={width} height={height} />
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
      {props.areas.map((area) => {
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
          compact={props.compact}
        />
      ))}
      <g transform={`translate(${EDGE / 2} ${height - EDGE / 2})`} className="plan__scale">
        <path className="plan__scale-bar" d={`M0 -8 V0 H${scale.px.toFixed(1)} V-8`} />
        <text className="plan__scale-label" x={scale.px / 2} y={-6} textAnchor="middle">
          {scale.label}
        </text>
      </g>
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
function Stand(props: { stand: PlanStand; at: [number, number]; compact?: boolean | undefined }) {
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
  const plateX = STAND / 2 + PLATE_GAP;
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
        <g transform={`translate(${plateX} ${-PLATE_HEIGHT / 2})`}>
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
