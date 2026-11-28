// Pointer and map helpers for tests that tap, drag and read positions on the club map (jsdom
// lays nothing out: every map is its 960 by 640 fallback, at the page's top left).
import { fireEvent, screen } from '@testing-library/react';

/**
 * jsdom's PointerEvent drops the mouse fields (clientX, button) a test gives it: a MouseEvent
 * with a pointerId stands in, as browsers' PointerEvent is.
 */
class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;
  readonly pointerType: string;
  constructor(
    type: string,
    init: MouseEventInit & { pointerId?: number; pointerType?: string; timeStamp?: number } = {},
  ) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? 'mouse';
    // A given time, so a test can make a slow drag or a flick.
    if (init.timeStamp !== undefined)
      Object.defineProperty(this, 'timeStamp', { value: init.timeStamp });
  }
}

/** Installs the stand-in PointerEvent around each test of the calling file. */
export function usePointerEvents() {
  beforeEach(() => vi.stubGlobal('PointerEvent', TestPointerEvent));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
}

/** The fallback size every map has in tests. */
export const MAP_W = 960;
export const MAP_H = 640;

/** The ground of My club's map (the picture that takes taps and drags). */
export const ground = () => screen.getByRole('img', { name: /^Map of Oak Ridge Hunt Club/ });

/** A tap (press and release without moving) on the map's ground at (x, y). */
export function tap(x: number, y: number) {
  fireEvent.pointerDown(ground(), { clientX: x, clientY: y, pointerId: 1 });
  fireEvent.pointerUp(ground(), { clientX: x, clientY: y, pointerId: 1 });
}

/** Drags an element on the map from where it is by (dx, dy), in two moves. */
export function drag(el: Element, dx: number, dy: number) {
  const [x, y] = translateOf(el);
  fireEvent.pointerDown(el, { clientX: x, clientY: y, pointerId: 2 });
  fireEvent.pointerMove(el, { clientX: x + dx / 2, clientY: y + dy / 2, pointerId: 2 });
  fireEvent.pointerMove(el, { clientX: x + dx, clientY: y + dy, pointerId: 2 });
  fireEvent.pointerUp(el, { clientX: x + dx, clientY: y + dy, pointerId: 2 });
}

/** Where a map marker or corner is: its group's translate(x y). */
export const translateOf = (el: Element) =>
  el
    .getAttribute('transform')!
    .match(/translate\(([-\d.]+) ([-\d.]+)\)/)!
    .slice(1)
    .map(Number) as [number, number];

/** My club's "+" menu beside Stands and areas (admins). */
export const ADD_MENU = 'Add a stand or area';

/** Starts adding a stand or an area from My club's "+" menu. */
export function addToMap(what: 'stand' | 'area') {
  fireEvent.click(screen.getByRole('button', { name: ADD_MENU }));
  fireEvent.click(
    screen.getByRole('button', { name: what === 'stand' ? 'Add stand' : 'Add area' }),
  );
}
