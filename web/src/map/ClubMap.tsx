// The club plan: the club's own property line, areas and stands, for the admin pages where the
// map is the page (docs/DESIGN.md "The map is the page"). Under it, live USGS tiles of the chosen
// basemap (basemap.ts: plain images from the one USGS host the CSP allows), over the club's own
// map pack when one is ready, which still shows offline; with neither, a plain ground. An
// `interactive` map pans and zooms (drag, wheel, arrow keys, and its own buttons) and goes
// anywhere, so an admin with nothing drawn yet can find the property. It draws only real
// geometry: nothing here is decoration or a sample unless the caller says so. Everything is
// SVG with classes, so the CSP needs no inline styles.
import {
  breakpoints,
  fontSize,
  fontWidth,
  mapChrome,
  radii,
  sizes,
  space,
  visibleLabels,
  type FontWidth,
  type LabelCandidate,
} from '@huntclub/design';
import {
  BASEMAP_IDS,
  BASEMAPS,
  polygonRings,
  STAND_STATUS_LABELS,
  STAND_TYPE_LABELS,
  type BasemapId,
  type StandType,
} from '@huntclub/shared';
import {
  Layers,
  LocateFixed,
  MapPinOff,
  Maximize,
  Minus,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { Button, EmptyState, Popover, Segmented, Switch } from '../components/ui';
import { standIcon } from '../components/standIcons';
import { useElementSize, type Size } from '../components/useElementSize';
import { cx } from '../components/ui/cx';
import { liveBasemap, type BasemapPicture } from './basemap';
import {
  DEFAULT_VIEW,
  fitPlan,
  LOCATION_ZOOM,
  panView,
  plateSide,
  planBounds,
  ringsLabelPoint,
  ringsPath,
  scaleBar,
  viewProjection,
  zoomView,
  type Insets,
  type PlanGeometry,
  type Projection,
  type View,
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

/** The map as it is drawn now, for layers drawn over it (the property line editor). */
export interface MapFrame {
  projection: Projection;
  width: number;
  height: number;
  /** The map's own box on the page, for turning a pointer's page position into map px. */
  box: () => DOMRect | undefined;
}

/** Until the box is measured (and in tests): a desktop map's size. */
const FALLBACK_SIZE = { width: 960, height: 640 };
/** Ground kept around everything the plan draws, in px: it fits to its bounds with this padding. */
export const FIT_PADDING = space[12];
const EDGE = FIT_PADDING;
/** An area's name sits this far inside its north edge, in px. */
const AREA_LABEL_DROP = 20;
/** The scale bar's longest length, in px: it shares the footer line with the credit. */
const SCALE_MAX_PX = 96;
/** Gaps on the footer line: bar to its length, length to the credit, in px. */
const FOOTER_GAP = { label: 6, credit: 12 };
/** Where the footer line's baseline sits above its bottom, in px. */
const FOOTER_BASELINE = 7;
/** Stand marker, icon and plate geometry (packages/design sizes and radii). */
const STAND = sizes.standMarker;
/** A stand that opens its details is tapped over a 48 px square around the marker. */
const HIT = sizes.minTapTarget;
const ICON = sizes.icon;
const PLATE_PAD = 8;
const PLATE_PAD_Y = 6;
const PLATE_GAP = 6;
const PLATE_LINE = { name: fontSize.markerName };
/** A stand's label: its name on one line, within the label cap (mapChrome.labels). */
const PLATE_HEIGHT = Math.min(mapChrome.labels.maxHeight, PLATE_LINE.name + 2 * PLATE_PAD_Y);
const PLATE_MAX_WIDTH = mapChrome.labels.maxWidth;
/** A press that moves less than this many px is a tap, not a drag. */
export const TAP_SLOP = 4;
/** Arrow keys move the map this many px (ten times that with Shift). */
export const KEY_PAN_PX = 64;
/** One wheel notch (100 px of scroll) zooms this many levels. */
const WHEEL_ZOOM_PER_PX = 1 / 200;

/**
 * Archivo's average advance width at bold weights, as a share of the font size; with the
 * width axis it sizes a plate to its words (SVG text has no layout of its own).
 */
const AVERAGE_ADVANCE = 0.56;
const textWidth = (text: string, size: number, width: FontWidth) =>
  text.length * size * AVERAGE_ADVANCE * (width / 100);

/** `text`, cut with an ellipsis where it would run past `maxPx`. */
export function fitText(text: string, maxPx: number, size: number, width: FontWidth): string {
  if (textWidth(text, size, width) <= maxPx) return text;
  const chars = Math.max(1, Math.floor(maxPx / textWidth('m', size, width)) - 1);
  return `${text.slice(0, chars).trimEnd()}…`;
}

/** A stand's label on the map: its name as shown, and the plate's size and side. */
function standLabel(stand: PlanStand, x: number, mapWidth: number) {
  const room = PLATE_MAX_WIDTH - 2 * PLATE_PAD;
  const name = fitText(stand.name, room, PLATE_LINE.name, fontWidth.marker);
  const width = Math.min(
    PLATE_MAX_WIDTH,
    2 * PLATE_PAD + textWidth(name, PLATE_LINE.name, fontWidth.marker),
  );
  // Right of the stand, or left of it where the right would run off the map.
  const side = plateSide(x, STAND / 2 + PLATE_GAP, width, mapWidth);
  const offset = side === 'right' ? STAND / 2 + PLATE_GAP : -(STAND / 2 + PLATE_GAP + width);
  return { name, width, side, offset };
}

/** Which stands show their name (mapChrome.labels): the rest are icons until tapped or zoomed. */
function labelledStands(
  stands: readonly PlanStand[],
  projection: Projection,
  mapWidth: number,
  selected: string | null,
): Set<string> {
  const candidates: LabelCandidate[] = stands.map((stand) => {
    const [x, y] = projection.project(stand.lon, stand.lat);
    const label = standLabel(stand, x, mapWidth);
    return {
      id: stand.id,
      marker: { x: x - HIT / 2, y: y - HIT / 2, width: HIT, height: HIT },
      label: {
        x: x + label.offset,
        y: y - PLATE_HEIGHT / 2,
        width: label.width,
        height: PLATE_HEIGHT,
      },
    };
  });
  return visibleLabels(candidates, projection.view.zoom, selected);
}

/** What the Layers popover shows or hides on the map. */
export interface ShownLayers {
  stands: boolean;
  areas: boolean;
}

/** A pointer's position in the map's own px. */
export const mapPoint = (box: DOMRect | undefined, e: { clientX: number; clientY: number }) =>
  [e.clientX - (box?.left ?? 0), e.clientY - (box?.top ?? 0)] as [number, number];

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
  /** The club's own map pack under the plan (null: none). */
  basemap?: BasemapPicture | null;
  /** Live USGS tiles of this basemap under the plan (over the pack, which shows if they cannot load). */
  live?: BasemapId | null;
  /** With `live`: the basemap switcher among the map's controls calls this. */
  onLiveChange?: (basemap: BasemapId) => void;
  /** Pans and zooms, with the map's own controls; with nothing to fit, starts over the lower 48. */
  interactive?: boolean;
  /** A tap on the map's ground (not a drag): where it was, in [lon, lat]. Pins the view. */
  onMapClick?: (at: [number, number]) => void;
  /** Layers drawn over the map, with its projection (the property line editor). */
  overlay?: (frame: MapFrame) => ReactNode;
  /**
   * Room taken along the map's bottom edge by a bar over it, in px (or worked out from the
   * map's size): the scale bar, the credit and the map's controls stay above it.
   */
  footer?: number | ((size: Size) => number);
  className?: string;
  /** Plates floating over the map. */
  children?: ReactNode;
  /** Shown over the ground when there is nothing to draw yet (null: nothing, e.g. still loading). */
  empty?: MapEmpty | null;
  /**
   * Makes each stand a button (tap, Enter or Space) that calls this with it, e.g. to open its
   * details. Without it the stands are part of the picture.
   */
  onStandSelect?: (stand: PlanStand) => void;
  /** The stand whose details are open: its marker is drawn as the selected item. */
  selectedStandId?: string | null;
  /** Makes each area's name a button that calls this with it (an admin edits the area). */
  onAreaSelect?: (area: PlanArea) => void;
  /**
   * Brings a point into the open map once per `key` (what an editor opened): across the middle,
   * halfway between `top` px (a plate's bottom) and the footer. `top` 0 waits for it.
   */
  focus?: { key: string; at: [number, number]; top: number } | null;
  /** More rows for the Layers popover (with `interactive`), after the basemap and the layers. */
  layers?: (close: () => void) => ReactNode;
  /** Editing on the map (docs/DESIGN.md "Map chrome" 7): the icon stack hides. */
  editing?: boolean;
  /** The chrome never fades while the map moves (an alert, a quiet mesh, near an overdue time). */
  pinned?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const size = useElementSize(box, FALLBACK_SIZE);
  const { width, height } = size;
  const compact = props.compact ?? false;
  const interactive = props.interactive ?? false;
  const footer = (typeof props.footer === 'function' ? props.footer(size) : props.footer) ?? 0;
  // Under the tablet width stand names stay, but area names would sit on the stands.
  const areaNames = !compact && width >= breakpoints.tablet;
  const bounds = planBounds(props);
  // The layers the Layers popover shows (all of them until it hides one).
  const [shownLayers, setShownLayers] = useState<ShownLayers>({ stands: true, areas: true });
  const areas = shownLayers.areas ? props.areas : [];
  const stands = shownLayers.stands ? props.stands : [];
  // The plan fits clear of the icon stack and above the footer line.
  const given = typeof props.insets === 'function' ? props.insets(size) : props.insets;
  const stackRoom = interactive ? mapChrome.stack.button + 2 * mapChrome.inset : EDGE;
  const footerRoom = footer + mapChrome.footer.height + mapChrome.inset;
  const insets: Insets = {
    top: EDGE,
    right: Math.max(EDGE, stackRoom),
    left: EDGE,
    ...given,
    bottom: Math.max(given?.bottom ?? EDGE, footerRoom),
  };
  // Auto-hide (docs/DESIGN.md "Map chrome" 5): moving the map fades the chrome; it comes back
  // once the map has been still a moment, or at once on a tap or when focus reaches it.
  const [moving, setMoving] = useState(false);
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const moved = () => {
    clearTimeout(idle.current);
    setMoving(true);
    idle.current = setTimeout(() => setMoving(false), mapChrome.autoHide.idleMs);
  };
  const still = () => {
    clearTimeout(idle.current);
    setMoving(false);
  };
  useEffect(() => () => clearTimeout(idle.current), []);
  // The view the admin moved to; until then, the plan's own fit (or the lower 48).
  const [view, setView] = useState<View | null>(null);
  // While something is drawn by tapping, the map holds still where it was (what it draws may
  // change, and a plate may resize, but it never refits).
  const pin = Boolean(props.onMapClick);
  const shown = useRef<View | null>(null);
  const held = pin && !view ? shown.current : null;
  const projection = view
    ? viewProjection(view, width, height)
    : held
      ? viewProjection(held, width, height)
      : bounds
        ? fitPlan(bounds, width, height, insets)
        : interactive
          ? viewProjection(DEFAULT_VIEW, width, height)
          : null;
  shown.current = projection?.view ?? null;
  useEffect(() => {
    if (pin && !view && shown.current) setView(shown.current);
  }, [pin]);
  const focused = useRef<string | null>(null);
  const focus = props.focus;
  useEffect(() => {
    if (!focus) {
      focused.current = null;
      return;
    }
    if (focus.top <= 0 || focused.current === focus.key || !shown.current) return;
    focused.current = focus.key;
    const bottom = height - footerRoom;
    const centred = { ...shown.current, lon: focus.at[0], lat: focus.at[1] };
    setView(panView(centred, 0, (focus.top + bottom) / 2 - height / 2));
  }, [focus?.key, focus?.top]);
  const frame = (): DOMRect | undefined => box.current?.getBoundingClientRect();
  const labelled =
    projection && !compact
      ? labelledStands(stands, projection, width, props.selectedStandId ?? null)
      : new Set<string>();
  const live = props.live && projection ? liveBasemap(props.live, projection, width, height) : null;
  // The pack shows under live tiles of its own basemap only, so the credit is always one.
  const pack =
    props.basemap && (!props.live || props.basemap.basemap.id === props.live)
      ? props.basemap
      : null;

  const move = (next: View) => setView(next);
  const drag = useRef<{ x: number; y: number; from: View; moved: boolean } | null>(null);
  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (!projection || (!interactive && !props.onMapClick)) return;
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, from: projection.view, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || !interactive) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < TAP_SLOP) return;
    d.moved = true;
    moved();
    move(panView(d.from, dx, dy));
  };
  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) still();
    if (!d || d.moved || !projection || !props.onMapClick) return;
    props.onMapClick(projection.unproject(...mapPoint(frame(), e)));
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (!projection) return;
    const step = e.shiftKey ? KEY_PAN_PX * 10 : KEY_PAN_PX;
    const pans: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const pan = pans[e.key];
    if (pan) move(panView(projection.view, ...pan));
    else if (e.key === '+' || e.key === '=') move(zoomView(projection.view, 1, width, height));
    else if (e.key === '-' || e.key === '_') move(zoomView(projection.view, -1, width, height));
    else return;
    moved();
    e.preventDefault(); // arrows would scroll the page
  };
  // The wheel zooms around the pointer; React's wheel listener is passive, so this one is not.
  const svg = useRef<SVGSVGElement>(null);
  const latest = useRef({ projection, width, height });
  latest.current = { projection, width, height };
  useEffect(() => {
    const element = svg.current;
    if (!interactive || !element) return;
    const onWheel = (e: WheelEvent) => {
      const { projection: p, width: w, height: h } = latest.current;
      if (!p) return;
      e.preventDefault();
      const delta = Math.max(-1, Math.min(1, -e.deltaY * WHEEL_ZOOM_PER_PX));
      moved();
      setView(zoomView(p.view, delta, w, h, mapPoint(frame(), e)));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [interactive]);

  return (
    <div
      ref={box}
      className={cx(
        'plan',
        interactive && 'plan--interactive',
        moving && !props.pinned && 'plan--moving',
        props.className,
      )}
      // Focus reaching the chrome (Tab from the map) brings it back.
      onFocus={(e) => {
        if ((e.target as Element) !== svg.current) still();
      }}
    >
      <svg
        ref={svg}
        className={cx('plan__svg', (interactive || props.onMapClick) && 'plan__svg--ground')}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={
          interactive
            ? `${props.label} Arrow keys move the map; plus and minus zoom in and out.`
            : props.label
        }
        {...(interactive
          ? { tabIndex: 0, onKeyDown, onPointerDown, onPointerMove, onPointerUp }
          : props.onMapClick
            ? { onPointerDown, onPointerUp }
            : {})}
        onPointerCancel={() => (drag.current = null)}
      >
        <rect className="plan__ground" width={width} height={height} />
        {projection ? (
          <Drawing
            {...props}
            areas={areas}
            stands={stands}
            labelled={labelled}
            basemap={pack}
            live={live}
            compact={compact}
            areaNames={areaNames}
            projection={projection}
            width={width}
            height={height}
            footer={footer}
          />
        ) : null}
      </svg>
      {/* Like the names they are, only where there is room beside the stands (tablet up). */}
      {projection && props.onAreaSelect && areaNames ? (
        <AreaButtons
          areas={areas}
          projection={projection}
          width={width}
          height={height}
          onSelect={props.onAreaSelect}
        />
      ) : null}
      {projection && props.onStandSelect ? (
        <StandButtons
          stands={stands}
          projection={projection}
          width={width}
          height={height}
          labelled={labelled}
          onSelect={props.onStandSelect}
          selectedId={props.selectedStandId ?? null}
        />
      ) : null}
      {projection && props.overlay
        ? props.overlay({ projection, width, height, box: frame })
        : null}
      {props.children}
      {interactive && projection && !props.editing ? (
        <MapStack
          live={props.live ?? null}
          onLiveChange={props.onLiveChange}
          onZoom={(delta) => move(zoomView(projection.view, delta, width, height))}
          onFit={bounds ? () => setView(null) : undefined}
          onLocate={(lon, lat) => move({ lon, lat, zoom: LOCATION_ZOOM })}
          shown={shownLayers}
          onShownChange={setShownLayers}
          layers={props.layers}
        />
      ) : null}
      {/* After the plates, so its heading follows the page's own in the outline. */}
      {bounds || !props.empty ? null : <MapEmptyPlate {...props.empty} />}
    </div>
  );
}

/** Whether this browser can find where it is (none in tests or with location turned off). */
const canLocate = () => typeof navigator !== 'undefined' && 'geolocation' in navigator;

/**
 * The map's own controls (docs/DESIGN.md "Map chrome" 3): one stack of 48 px icon buttons at the
 * right edge, each with a name and a tooltip. Layers opens the basemap, Fit property, the layers'
 * show and hide, and the page's own rows; then, on a desktop, the split zoom; then Find me (the
 * admin's own location, used here only and never sent).
 */
function MapStack(props: {
  live: BasemapId | null;
  onLiveChange?: ((basemap: BasemapId) => void) | undefined;
  onZoom: (delta: number) => void;
  onFit?: (() => void) | undefined;
  onLocate: (lon: number, lat: number) => void;
  shown: ShownLayers;
  onShownChange: (shown: ShownLayers) => void;
  layers?: ((close: () => void) => ReactNode) | undefined;
}) {
  const [locating, setLocating] = useState<'idle' | 'busy' | 'failed'>('idle');
  const locate = () => {
    setLocating('busy');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating('idle');
        props.onLocate(position.coords.longitude, position.coords.latitude);
      },
      () => setLocating('failed'),
      { maximumAge: 60_000, timeout: 15_000 },
    );
  };
  const toggle = (layer: keyof ShownLayers, label: string) => (
    <Switch
      label={label}
      checked={props.shown[layer]}
      onChange={(e) => props.onShownChange({ ...props.shown, [layer]: e.target.checked })}
    />
  );
  return (
    <div className="map-stack map-fade" role="group" aria-label="Map controls">
      <Popover
        label="Map layers"
        tooltip="Layers"
        trigger={<Layers size={sizes.icon} aria-hidden />}
        placement="bottom-end"
        className="map-stack__layers"
        triggerClassName="map-stack__button"
        panelClassName="map-layers"
      >
        {(close) => (
          <>
            {props.live && props.onLiveChange ? (
              <Segmented
                legend="Basemap"
                hideLegend
                block
                options={BASEMAP_IDS.map((id) => ({ value: id, label: BASEMAPS[id].label }))}
                value={props.live}
                onChange={props.onLiveChange}
              />
            ) : null}
            <div className="map-layers__switches">
              {toggle('stands', 'Stands')}
              {toggle('areas', 'Areas')}
            </div>
            {props.onFit ? (
              <Button
                size="sm"
                icon={Maximize}
                onClick={() => {
                  props.onFit!();
                  close();
                }}
              >
                Fit property
              </Button>
            ) : null}
            {props.layers?.(close)}
          </>
        )}
      </Popover>
      <div className="map-stack__zoom" role="group" aria-label="Zoom">
        <Button size="sm" iconOnly label="Zoom in" icon={Plus} onClick={() => props.onZoom(1)} />
        <Button size="sm" iconOnly label="Zoom out" icon={Minus} onClick={() => props.onZoom(-1)} />
      </div>
      {canLocate() ? (
        <Button
          size="sm"
          iconOnly
          label="Find me"
          icon={LocateFixed}
          loading={locating === 'busy'}
          onClick={locate}
          className="map-stack__button"
        />
      ) : null}
      {locating === 'failed' ? (
        <p className="map-stack__note" role="status">
          Location is off for this site. Turn it on in the browser, or move the map by hand.
        </p>
      ) : null}
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
  props: Omit<Parameters<typeof ClubMap>[0], 'live' | 'footer'> & {
    footer: number;
    labelled: ReadonlySet<string>;
    live: BasemapPicture | null;
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
  const credit = props.live?.basemap.credit ?? basemap?.basemap.credit;
  return (
    <g aria-hidden="true">
      {/* The pack, else the grid (which shows wherever live tiles cannot load, e.g. offline). */}
      {basemap ? (
        <Basemap picture={basemap} projection={projection} />
      ) : (
        <Grid step={scale.px} origin={projection.project(0, 0)} width={width} height={height} />
      )}
      {props.live ? <Basemap picture={props.live} projection={projection} live /> : null}
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
      {/* Small maps leave names to the lists beside them: labels would sit on the stands. Areas
          that open for editing are buttons, drawn on the layer above (AreaButtons). */}
      {!props.areaNames || props.onAreaSelect
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
      {/* Stands that open their details are buttons, drawn on the layer above (StandButtons). */}
      {props.onStandSelect
        ? null
        : props.stands.map((stand) => (
            <Stand
              key={stand.id}
              stand={stand}
              at={projection.project(stand.lon, stand.lat)}
              labelled={props.labelled.has(stand.id)}
              mapWidth={width}
            />
          ))}
      {/* The footer line (docs/DESIGN.md "Map chrome" 6): the scale bar, its length and the credit,
          bottom left, above whatever takes the map's bottom edge (the sheet's peek). */}
      <g
        transform={`translate(${mapChrome.inset} ${height - props.footer - FOOTER_BASELINE})`}
        className="plan__footer map-fade"
      >
        <g className="plan__scale">
          <path className="plan__scale-bar" d={`M0 -8 V0 H${scale.px.toFixed(1)} V-8`} />
          <text className="plan__scale-label" x={scale.px + FOOTER_GAP.label} y={0}>
            {scale.label}
          </text>
        </g>
        {credit ? (
          <text
            className="plan__credit"
            x={
              scale.px +
              FOOTER_GAP.label +
              textWidth(scale.label, fontSize.mapLabelMin, fontWidth.markerDetail) +
              FOOTER_GAP.credit
            }
            y={0}
          >
            {credit}
          </text>
        ) : null}
      </g>
    </g>
  );
}

/** A basemap picture (the club's map pack, or live USGS tiles): each tile where it lies on the ground. */
function Basemap(props: { picture: BasemapPicture; projection: Projection; live?: boolean }) {
  return (
    <g className={cx('plan__basemap', props.live && 'plan__basemap--live')}>
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

/**
 * The areas' names as buttons, on a layer over the picture (an admin opens an area to edit it):
 * each name sits where the plan puts it, over a 48 px tall target, and opens with a tap, Enter
 * or Space. The layer lets every other tap through to the map.
 */
function AreaButtons(props: {
  areas: readonly PlanArea[];
  projection: Projection;
  width: number;
  height: number;
  onSelect: (area: PlanArea) => void;
}) {
  const { width, height } = props;
  return (
    <svg
      className="plan__svg plan__stands"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="group"
      aria-label="Areas"
    >
      {props.areas.map((area) => {
        const at = ringsLabelPoint(polygonRings(area.boundary));
        if (!at) return null;
        const [x, y] = props.projection.project(...at);
        const open = () => props.onSelect(area);
        const wide = Math.max(
          HIT,
          textWidth(area.name, fontSize.mapLabelMin, fontWidth.markerDetail) + 2 * PLATE_PAD,
        );
        return (
          <g
            key={area.id}
            transform={`translate(${x.toFixed(1)} ${(y + AREA_LABEL_DROP).toFixed(1)})`}
            className="plan__stand--button plan__area-button"
            role="button"
            tabIndex={0}
            aria-label={`${area.name}, area`}
            onClick={open}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              open();
            }}
          >
            <rect
              className="plan__stand-hit"
              x={-wide / 2}
              y={-HIT / 2 - 4}
              width={wide}
              height={HIT}
              rx={radii.md}
            />
            <text className="plan__label" textAnchor="middle">
              {area.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * The stands as buttons, on a layer over the picture (whose role="img" hides what is inside it
 * from screen readers). Each reads out its name, type and status, and opens with a tap, Enter or
 * Space; the layer lets every other tap through to the map.
 */
function StandButtons(props: {
  stands: readonly PlanStand[];
  projection: Projection;
  width: number;
  height: number;
  labelled: ReadonlySet<string>;
  onSelect: (stand: PlanStand) => void;
  selectedId: string | null;
}) {
  const { width, height } = props;
  return (
    <svg
      className="plan__svg plan__stands"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="group"
      aria-label="Stands"
    >
      {props.stands.map((stand) => {
        const open = () => props.onSelect(stand);
        const onKeyDown = (e: KeyboardEvent) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault(); // Space would scroll the page
          open();
        };
        return (
          <Stand
            key={stand.id}
            stand={stand}
            at={props.projection.project(stand.lon, stand.lat)}
            labelled={props.labelled.has(stand.id)}
            mapWidth={width}
            button={{ onClick: open, onKeyDown, selected: stand.id === props.selectedId }}
          />
        );
      })}
    </svg>
  );
}

/**
 * A stand: the rounded square with its type's icon and, where there is room (`labelled`), its
 * name on a plate capped at mapChrome.labels. Open or Closed is read out with the name and
 * shown in the stand's details; a closed stand's icon and name are drawn quieter.
 */
function Stand(props: {
  stand: PlanStand;
  at: [number, number];
  labelled: boolean;
  mapWidth: number;
  /** A stand that opens its details (StandButtons). */
  button?: { onClick: () => void; onKeyDown: (e: KeyboardEvent) => void; selected: boolean };
}) {
  const { stand, button } = props;
  const [x, y] = props.at;
  const Icon = standIcon(stand.type);
  const status = STAND_STATUS_LABELS[stand.active ? 'open' : 'closed'];
  const label = standLabel(stand, x, props.mapWidth);
  return (
    <g
      transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
      className={cx(
        'plan__stand',
        !stand.active && 'plan__stand--closed',
        button && 'plan__stand--button',
        button?.selected && 'plan__stand--selected',
      )}
      {...(button
        ? {
            role: 'button',
            tabIndex: 0,
            // The name first (what a voice-control user says), then its status and type.
            'aria-label': `${stand.name}, ${status}, ${STAND_TYPE_LABELS[stand.type]}`,
            'aria-haspopup': 'dialog' as const,
            onClick: button.onClick,
            onKeyDown: button.onKeyDown,
          }
        : {})}
    >
      {button ? (
        <rect
          className="plan__stand-hit"
          x={-HIT / 2}
          y={-HIT / 2}
          width={HIT}
          height={HIT}
          rx={radii.md}
        />
      ) : null}
      <rect
        className="plan__stand-box"
        x={-STAND / 2}
        y={-STAND / 2}
        width={STAND}
        height={STAND}
        rx={radii.standMarker}
      />
      <Icon x={-ICON / 2} y={-ICON / 2} size={ICON} className="plan__stand-icon" />
      {props.labelled ? (
        <g
          transform={`translate(${label.offset.toFixed(1)} ${-PLATE_HEIGHT / 2})`}
          className={`plan__plate-group plan__plate-group--${label.side}`}
        >
          <rect
            className="plan__plate"
            width={label.width}
            height={PLATE_HEIGHT}
            rx={radii.markerPlate}
          />
          <text
            className="plan__plate-name"
            x={PLATE_PAD}
            y={PLATE_HEIGHT / 2 + PLATE_LINE.name * 0.35}
          >
            {label.name}
          </text>
        </g>
      ) : null}
    </g>
  );
}
