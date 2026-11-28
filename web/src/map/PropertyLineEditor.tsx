// Drawing a shape on the web, the property line or an area (club admins only; the club API checks
// that too). Tap or click the map to add corners, drag a corner to move it, tap the first corner
// or Close shape to finish, then Save. Every corner is a 48 px button: focus selects it, the arrow
// keys move it, Delete removes it. "Add corner" puts one at the cross in the middle of the map,
// so the whole shape can be drawn from the keyboard. The state is draw.ts; whether a shape may be
// saved is its shared rule (DRAW_SUBJECTS), and saving goes through the shared club API client.
import { radii, sizes } from '@huntclub/design';
import {
  AREA_PROBLEMS,
  areaProblem,
  ClubApiRequestError,
  pluralize,
  PROPERTY_LINE_PROBLEMS,
  propertyLineProblem,
  ringAcres,
  type Polygon,
} from '@huntclub/shared';
import { Pentagon, Plus, Trash2, Undo2, type LucideIcon } from 'lucide-react';
import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Button, useToast, type ToastMessage } from '../components/ui';
import { cx } from '../components/ui/cx';
import { mapPoint, PropertyLine, TAP_SLOP, type MapFrame } from './ClubMap';
import { InSlot, useEditSlots } from './editSlots';
import { EditPill } from './MapPill';
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
export function DrawLayer(props: {
  frame: MapFrame;
  state: DrawState;
  dispatch: Dispatch;
  /** The corners' group name (default: the property line's). */
  label?: string;
}) {
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
      aria-label={props.label ?? 'Property line corners'}
    >
      {state.closed ? (
        <g aria-hidden="true">
          <PropertyLine d={ringsPath([state.corners], projection)} />
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
          <Cross width={width} height={height} />
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

/** The cross in the middle of the map: where Add corner and Put at the cross put things. */
export function Cross(props: { width: number; height: number }) {
  const x = props.width / 2;
  const y = props.height / 2;
  return (
    <path
      className="draw__cross"
      aria-hidden="true"
      d={`M${x - CROSS} ${y} H${x + CROSS} M${x} ${y - CROSS} V${y + CROSS}`}
    />
  );
}

/** What is being drawn: its name in words, and its shared rule and words. */
export interface DrawSubject {
  noun: string;
  rule: (polygon: Polygon) => string | null;
  problems: Readonly<Record<string, string>>;
}

export const DRAW_SUBJECTS = {
  line: {
    noun: 'property line',
    rule: propertyLineProblem,
    problems: PROPERTY_LINE_PROBLEMS,
  },
  area: { noun: 'area', rule: areaProblem, problems: AREA_PROBLEMS },
} as const satisfies Record<string, DrawSubject>;

/** The toast once a save went through ("Stand saved"); the editor has closed by then. */
export const savedToast = (noun: string): ToastMessage => ({
  tone: 'success',
  title: `${noun.charAt(0).toUpperCase()}${noun.slice(1)} saved`,
});

/** Plain words for the club API's refusals of a save (of a shape, a stand or a deletion). */
export function saveError(error: unknown, noun: string): string {
  if (error instanceof ClubApiRequestError) {
    switch (error.code) {
      case 'invalid':
        return error.message;
      case 'forbidden':
        return `Only club admins can change the ${noun}.`;
      case 'network':
        return 'No connection. Try again when you are online.';
    }
  }
  return `Could not save the ${noun}. Try again.`;
}

/** What an open shape still needs before it can be saved. */
const OPEN = 'Close the shape to save it: tap the first corner, or Close shape.';

/** A draw-bar tool: a 48 px icon button with its name as a tooltip. */
function Action(props: {
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  children: string;
}) {
  return (
    <Button
      size="sm"
      iconOnly
      label={props.children}
      icon={props.icon}
      onClick={props.onClick}
      disabled={props.disabled}
    />
  );
}

/**
 * The shape editor's chrome, in the page's edit slots (editSlots.tsx): the pill names what is
 * drawn, with Done (saves) and Cancel; the draw bar has the count and Add corner, Undo, Remove
 * corner and Close shape; the sheet or panel has how to draw, the subject's fields and what is
 * still needed. What may be saved is the subject's shared rule.
 */
export function DrawControls(props: {
  frame: MapFrame;
  state: DrawState;
  dispatch: Dispatch;
  onSave: (boundary: Polygon) => Promise<void>;
  onCancel: () => void;
  /** What is drawn (default: the property line). */
  subject?: DrawSubject;
  /** More fields for what is drawn (an area's name, its delete), with the how-to. */
  fields?: ReactNode;
  /** A check of those fields before the shape's own: what to fix, or null. */
  validate?: () => string | null;
}) {
  const { state, dispatch } = props;
  const slots = useEditSlots();
  const subject: DrawSubject = props.subject ?? DRAW_SUBJECTS.line;
  const stillNeeded = (problem: string) =>
    problem === 'open' ? OPEN : (subject.problems[problem] ?? problem);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const [error, setErrorState] = useState<string | null>(null);
  const setError = (message: string | null) => {
    setErrorState(message);
    if (message) slots.reveal();
  };
  const problem = drawProblem(state, subject.rule);
  const n = state.corners.length;
  const act = (action: DrawAction) => {
    setErrorState(null);
    dispatch(action);
  };
  const save = async () => {
    // The fields, then the shared rule: a shape it refuses is never sent.
    const invalid = props.validate?.();
    if (invalid) return setError(invalid);
    if (problem) return setError(stillNeeded(problem));
    setBusy(true);
    setErrorState(null);
    try {
      await props.onSave(drawnPolygon(state));
      toast(savedToast(subject.noun));
    } catch (e) {
      setError(saveError(e, subject.noun));
      setBusy(false);
    }
  };

  const count = (
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
  );
  return (
    <>
      <InSlot slot="pill">
        <EditPill
          label={`Drawing ${subject.noun}`}
          onDone={() => void save()}
          onCancel={props.onCancel}
          busy={busy}
        />
      </InSlot>
      <InSlot slot="bar">
        <div className="draw-bar" role="group" aria-label={`Drawing the ${subject.noun}`}>
          {count}
          {state.closed ? null : (
            <Action icon={Plus} onClick={() => act({ type: 'add', at: centre(props.frame) })}>
              Add corner
            </Action>
          )}
          <Action
            icon={Undo2}
            onClick={() => act({ type: 'undo' })}
            disabled={!state.history.length}
          >
            Undo
          </Action>
          <Action
            icon={Trash2}
            onClick={() =>
              state.selected !== null && act({ type: 'remove', index: state.selected })
            }
            disabled={state.selected === null}
          >
            Remove corner
          </Action>
          {state.closed ? null : (
            <Action
              icon={Pentagon}
              onClick={() => act({ type: 'close' })}
              disabled={!canClose(state)}
            >
              Close shape
            </Action>
          )}
        </div>
      </InSlot>
      <InSlot slot="body">
        <div className="draw">
          <p className="draw__how">
            {state.closed
              ? 'Drag a corner to move it, or select it and use the arrow keys. Done saves the shape.'
              : 'Click the map to add corners, or move the map and use Add corner. Drag a corner to move it.'}
          </p>
          {props.fields}
          {/* What is still needed, unless the error below already says it: each once. */}
          {state.closed && problem && error !== stillNeeded(problem) ? (
            <p className="draw__problem">{stillNeeded(problem)}</p>
          ) : null}
          {error ? (
            <p className="draw__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </InSlot>
    </>
  );
}
