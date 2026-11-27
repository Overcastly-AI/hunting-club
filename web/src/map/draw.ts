// Drawing the property line on the web: the corners, whether the shape is closed, the selected
// corner and the undo history. Pure, so it is tested without a browser; the editor
// (PropertyLineEditor.tsx) turns taps, drags and keys into these actions. Whether a line may be
// saved is the shared rule (propertyLineProblem in @huntclub/shared), never a copy of it.
import {
  polygonRings,
  propertyLinePolygon,
  propertyLineProblem,
  PROPERTY_LINE_LIMITS,
  ringCorners,
  type Polygon,
  type PropertyLineProblem,
  type Ring,
} from '@huntclub/shared';

type LonLat = [lon: number, lat: number];

interface Shape {
  corners: Ring;
  /** The last side (back to the first corner) is drawn: the line is a property, ready to save. */
  closed: boolean;
}

export interface DrawState extends Shape {
  /** The corner that moves with the arrow keys and that Remove corner takes away. */
  selected: number | null;
  /** Earlier shapes, newest last (Undo). */
  history: Shape[];
}

export type DrawAction =
  /** A tap on the map: a new corner after the last (only while the shape is open). */
  | { type: 'add'; at: LonLat }
  /** A corner moved to `to`. `record` keeps the shape before it for Undo (once per drag). */
  | { type: 'move'; index: number; to: LonLat; record: boolean }
  | { type: 'select'; index: number | null }
  | { type: 'remove'; index: number }
  | { type: 'close' }
  | { type: 'undo' };

/**
 * Where drawing starts: the club's line, closed, to edit (its first ring: the web draws one
 * polygon), or nothing yet.
 */
export function startDrawing(boundary?: { coordinates: unknown }): DrawState {
  const corners = boundary ? ringCorners(polygonRings(boundary)[0] ?? []) : [];
  return {
    corners,
    closed: corners.length >= PROPERTY_LINE_LIMITS.minPoints,
    selected: null,
    history: [],
  };
}

const shape = (state: DrawState): Shape => ({ corners: state.corners, closed: state.closed });
const record = (state: DrawState): Shape[] => [...state.history, shape(state)];

export function drawReducer(state: DrawState, action: DrawAction): DrawState {
  switch (action.type) {
    case 'add':
      if (state.closed || state.corners.length >= PROPERTY_LINE_LIMITS.maxPoints) return state;
      return {
        corners: [...state.corners, action.at],
        closed: false,
        selected: state.corners.length,
        history: record(state),
      };
    case 'move': {
      if (!state.corners[action.index]) return state;
      const corners = state.corners.map((c, i): LonLat => (i === action.index ? action.to : c));
      return {
        ...state,
        corners,
        selected: action.index,
        history: action.record ? record(state) : state.history,
      };
    }
    case 'select':
      return { ...state, selected: action.index };
    case 'remove': {
      if (!state.corners[action.index]) return state;
      const corners = state.corners.filter((_, i) => i !== action.index);
      return {
        corners,
        // Below the fewest corners a property can have, the shape opens again.
        closed: state.closed && corners.length >= PROPERTY_LINE_LIMITS.minPoints,
        selected: null,
        history: record(state),
      };
    }
    case 'close':
      if (!canClose(state)) return state;
      return { ...state, closed: true, history: record(state) };
    case 'undo': {
      const previous = state.history[state.history.length - 1];
      if (!previous) return state;
      return { ...previous, selected: null, history: state.history.slice(0, -1) };
    }
  }
}

/** The shape can be closed: it is open and has enough corners. */
export const canClose = (state: DrawState) =>
  !state.closed && state.corners.length >= PROPERTY_LINE_LIMITS.minPoints;

/** The line as it is saved: a closed GeoJSON Polygon. */
export const drawnPolygon = (state: DrawState): Polygon => propertyLinePolygon(state.corners);

/** Why the drawn line cannot be saved yet, or null when it can (the shared rule). */
export function drawProblem(state: DrawState): PropertyLineProblem | 'open' | null {
  if (!state.closed)
    return state.corners.length < PROPERTY_LINE_LIMITS.minPoints ? 'tooFewPoints' : 'open';
  return propertyLineProblem(drawnPolygon(state));
}
