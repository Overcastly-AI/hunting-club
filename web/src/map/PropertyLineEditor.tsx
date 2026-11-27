// Drawing the property line on the web (club admins only; the club API checks that too). Tap or
// click the map to add corners, drag a corner to move it, tap the first corner or Close shape to
// finish, then Save. Every corner is a 48 px button: focus selects it, the arrow keys move it,
// Delete removes it. "Add corner" puts one at the cross in the middle of the map, so the whole
// line can be drawn from the keyboard. The state is draw.ts; whether a line may be saved is the
// shared rule (propertyLineProblem), and saving goes through the shared club API client.
import { radii, sizes } from '@huntclub/design';
import {
  ClubApiRequestError,
  pluralize,
  PROPERTY_LINE_PROBLEMS,
  ringAcres,
  type Polygon,
} from '@huntclub/shared';
import { Check, Plus, Trash2, Undo2, X, type LucideIcon } from 'lucide-react';
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Button } from '../components/ui';
import { cx } from '../components/ui/cx';
import { mapPoint, TAP_SLOP, type MapFrame } from './ClubMap';
import { canClose, drawnPolygon, drawProblem, type DrawAction, type DrawState } from './draw';
import { ringsPath } from './plan';

/** A corner's dot, and the 48 px square that takes its taps. */
const DOT = 9;
const HIT = sizes.minTapTarget;
/** Arrow keys move the selected corner this many px (ten times that with Shift). */
export const KEY_MOVE_PX = 4;
/** The cross in the middle of the map, where Add corner puts one, in px. */
const CROSS = 12;

type Dispatch = (action: DrawAction) => void;

const centre = (frame: MapFrame) => frame.projection.unproject(frame.width / 2, frame.height / 2);

/** The line being drawn and its corners, over the map. */
export function DrawLayer(props: { frame: MapFrame; state: DrawState; dispatch: Dispatch }) {
  const { frame, state, dispatch } = props;
  const { projection, width, height } = frame;
  const points = state.corners.map(([lon, lat]) => projection.project(lon, lat));
  const drag = useRef<{ index: number; x: number; y: number; moved: boolean } | null>(null);
  const closable = canClose(state);

  const onPointerDown = (index: number) => (e: PointerEvent<SVGGElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    drag.current = { index, x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dispatch({ type: 'select', index });
  };
  const onPointerMove = (e: PointerEvent<SVGGElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < TAP_SLOP) return;
    const to = projection.unproject(...mapPoint(frame.box(), e));
    // The shape before the drag is kept once, so Undo puts the corner back where it was.
    dispatch({ type: 'move', index: d.index, to, record: !d.moved });
    d.moved = true;
  };
  const onPointerUp = (index: number) => () => {
    const d = drag.current;
    drag.current = null;
    // A tap on the first corner closes the shape.
    if (d && !d.moved && index === 0 && closable) dispatch({ type: 'close' });
  };
  const onKeyDown = (index: number) => (e: KeyboardEvent) => {
    const step = e.shiftKey ? KEY_MOVE_PX * 10 : KEY_MOVE_PX;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const by = moves[e.key];
    if (by) {
      const [x, y] = points[index]!;
      dispatch({
        type: 'move',
        index,
        to: projection.unproject(x + by[0], y + by[1]),
        record: true,
      });
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      dispatch({ type: 'remove', index });
    } else if ((e.key === 'Enter' || e.key === ' ') && index === 0 && closable) {
      dispatch({ type: 'close' });
    } else return;
    e.preventDefault();
  };

  const n = state.corners.length;
  return (
    <svg
      className="plan__svg plan__draw"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="group"
      aria-label="Property line corners"
    >
      {state.closed ? (
        <g aria-hidden="true">
          <path className="plan__line" d={ringsPath([state.corners], projection)} />
          <path className="plan__line-inner" d={ringsPath([state.corners], projection)} />
        </g>
      ) : (
        <g aria-hidden="true">
          {n > 1 ? (
            <path
              className="draw__line"
              d={points
                .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`)
                .join(' ')}
            />
          ) : null}
          <path
            className="draw__cross"
            d={`M${width / 2 - CROSS} ${height / 2} H${width / 2 + CROSS} M${width / 2} ${height / 2 - CROSS} V${height / 2 + CROSS}`}
          />
        </g>
      )}
      {points.map(([x, y], index) => {
        const closes = index === 0 && closable;
        return (
          <g
            key={index}
            transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
            className={cx(
              'draw__corner',
              state.selected === index && 'draw__corner--selected',
              closes && 'draw__corner--closes',
            )}
            role="button"
            tabIndex={0}
            aria-label={`Corner ${index + 1} of ${n}${closes ? ', closes the shape' : ''}`}
            aria-pressed={state.selected === index}
            onPointerDown={onPointerDown(index)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp(index)}
            onPointerCancel={() => (drag.current = null)}
            onFocus={() => dispatch({ type: 'select', index })}
            onKeyDown={onKeyDown(index)}
          >
            <rect
              className="draw__hit"
              x={-HIT / 2}
              y={-HIT / 2}
              width={HIT}
              height={HIT}
              rx={radii.md}
            />
            <circle className="draw__dot" r={closes ? DOT + 3 : DOT} />
          </g>
        );
      })}
    </svg>
  );
}

/** Plain words for the club API's refusals of a property line. */
function saveError(error: unknown): string {
  if (error instanceof ClubApiRequestError) {
    switch (error.code) {
      case 'invalid':
        return error.message;
      case 'forbidden':
        return 'Only club admins can change the property line.';
      case 'network':
        return 'No connection. Try again when you are online.';
    }
  }
  return 'Could not save the property line. Try again.';
}

/** What the line still needs before it can be saved. */
const STILL_NEEDED = {
  open: 'Close the shape to save it: tap the first corner, or Close shape.',
  ...PROPERTY_LINE_PROBLEMS,
} as const;

function Action(props: {
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  children: string;
}) {
  return (
    <Button size="sm" icon={props.icon} onClick={props.onClick} disabled={props.disabled}>
      {props.children}
    </Button>
  );
}

/**
 * The editor's words and buttons, on the map's plate: how to draw, how many corners and acres,
 * what is still needed, and Add corner, Undo, Remove corner, Close shape, Save and Cancel.
 */
export function DrawControls(props: {
  frame: MapFrame;
  state: DrawState;
  dispatch: Dispatch;
  onSave: (boundary: Polygon) => Promise<void>;
  onCancel: () => void;
}) {
  const { state, dispatch } = props;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem = drawProblem(state);
  const n = state.corners.length;
  const act = (action: DrawAction) => {
    setError(null);
    dispatch(action);
  };
  const save = async () => {
    // The shared rule first: a line it refuses is never sent.
    if (problem) return setError(STILL_NEEDED[problem]);
    setBusy(true);
    setError(null);
    try {
      await props.onSave(drawnPolygon(state));
    } catch (e) {
      setError(saveError(e));
      setBusy(false);
    }
  };
  return (
    <div className="draw">
      <p className="draw__how">
        {state.closed
          ? 'Drag a corner to move it, or select it and use the arrow keys.'
          : 'Click the map to add corners, or move the map and use Add corner. Drag a corner to move it.'}
      </p>
      <p className="draw__count" aria-live="polite">
        <span className="text-readout-inline">{pluralize(n, 'corner')}</span>
        {state.closed && !problem ? (
          <>
            {', '}
            <span className="text-readout-inline">
              {pluralize(Math.round(ringAcres(state.corners)), 'acre')}
            </span>
          </>
        ) : null}
      </p>
      {state.closed && problem ? <p className="draw__problem">{STILL_NEEDED[problem]}</p> : null}
      <div className="draw__actions">
        {state.closed ? null : (
          <Action icon={Plus} onClick={() => act({ type: 'add', at: centre(props.frame) })}>
            Add corner
          </Action>
        )}
        <Action icon={Undo2} onClick={() => act({ type: 'undo' })} disabled={!state.history.length}>
          Undo
        </Action>
        <Action
          icon={Trash2}
          onClick={() => state.selected !== null && act({ type: 'remove', index: state.selected })}
          disabled={state.selected === null}
        >
          Remove corner
        </Action>
        {state.closed ? null : (
          <Action icon={Check} onClick={() => act({ type: 'close' })} disabled={!canClose(state)}>
            Close shape
          </Action>
        )}
      </div>
      <div className="draw__actions">
        <Button variant="primary" size="sm" loading={busy} onClick={() => void save()}>
          Save line
        </Button>
        <Button size="sm" icon={X} onClick={props.onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
      {error ? (
        <p className="draw__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
