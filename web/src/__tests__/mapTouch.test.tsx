// Touch on the club map (the iPhone audit, 2026-11-28): two fingers pinch to zoom about their
// midpoint wherever they land, a double tap on the ground zooms in, and the whole map takes
// every finger (touch-action: none), so no pinch ever zooms the page.
import { mapChrome, sizes } from '@huntclub/design';
import { polygonRings } from '@huntclub/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { ClubMap, DRAW_PADDING } from '../map/ClubMap';
import { planBounds, VIEW_ZOOM } from '../map/plan';
import { SAMPLE_PLAN } from '../map/sampleProperty';
import { mapCss } from '../map/styles';
import { MAP_H, MAP_W, translateOf, usePointerEvents } from '../testing/mapPointer';

usePointerEvents();

const LABEL = 'Club';
const ground = () => screen.getByRole('img', { name: new RegExp(`^${LABEL}`) });
const zoom = () => Number(ground().getAttribute('data-zoom'));
const stand = () => screen.getByRole('button', { name: /^Creek Stand,/ });

type Point = readonly [number, number];
const finger = (id: number, [x, y]: Point) => ({
  pointerId: id,
  pointerType: 'touch',
  clientX: x,
  clientY: y,
});

/** Two fingers down on `on` (each on its own element), moved from `from` to `to`, then lifted. */
function pinch(
  on: readonly [Element, Element],
  from: readonly [Point, Point],
  to: readonly [Point, Point],
) {
  fireEvent.pointerDown(on[0], finger(1, from[0]));
  fireEvent.pointerDown(on[1], finger(2, from[1]));
  for (const step of [0.5, 1]) {
    const at = (i: 0 | 1): Point => [
      from[i][0] + (to[i][0] - from[i][0]) * step,
      from[i][1] + (to[i][1] - from[i][1]) * step,
    ];
    fireEvent.pointerMove(on[0], finger(1, at(0)));
    fireEvent.pointerMove(on[1], finger(2, at(1)));
  }
  fireEvent.pointerUp(on[0], finger(1, to[0]));
  fireEvent.pointerUp(on[1], finger(2, to[1]));
}

/** A touch tap on the ground at `at`, at time `time` (ms). */
function touchTap(at: Point, time: number) {
  const init = { ...finger(1, at), timeStamp: time };
  fireEvent.pointerDown(ground(), init);
  fireEvent.pointerUp(ground(), init);
}

function renderMap(props: Partial<Parameters<typeof ClubMap>[0]> = {}) {
  const onStandSelect = vi.fn();
  render(
    <ClubMap {...SAMPLE_PLAN} label={LABEL} interactive onStandSelect={onStandSelect} {...props} />,
  );
  return { onStandSelect };
}

const MID: Point = [MAP_W / 2, MAP_H / 2];

describe('pinch zoom', () => {
  it('zooms one level as two fingers spread to twice as far apart, about their midpoint', () => {
    renderMap();
    const before = zoom();
    const [sx, sy] = translateOf(stand());
    pinch(
      [ground(), ground()],
      [
        [MID[0] - 50, MID[1]],
        [MID[0] + 50, MID[1]],
      ],
      [
        [MID[0] - 100, MID[1]],
        [MID[0] + 100, MID[1]],
      ],
    );
    expect(zoom()).toBeCloseTo(before + 1, 2);
    // The ground under the midpoint stayed put: the stand moved twice as far from it.
    const [x, y] = translateOf(stand());
    expect(x).toBeCloseTo(MID[0] + 2 * (sx - MID[0]), 0);
    expect(y).toBeCloseTo(MID[1] + 2 * (sy - MID[1]), 0);
  });

  it('pans with the fingers: the ground under the midpoint follows it', () => {
    renderMap();
    const [sx, sy] = translateOf(stand());
    // The same spread, both fingers 40 px right and 30 px down: no zoom, a pan.
    pinch(
      [ground(), ground()],
      [
        [300, 300],
        [500, 300],
      ],
      [
        [340, 330],
        [540, 330],
      ],
    );
    const [x, y] = translateOf(stand());
    expect(x).toBeCloseTo(sx + 40, 0);
    expect(y).toBeCloseTo(sy + 30, 0);
  });

  it('works when a finger lands on a stand, and opens nothing', () => {
    const { onStandSelect } = renderMap();
    const before = zoom();
    const at = translateOf(stand());
    pinch(
      [stand(), ground()],
      [at, [at[0] + 80, at[1]]],
      [
        [at[0] - 80, at[1]],
        [at[0] + 160, at[1]],
      ],
    );
    fireEvent.click(stand(), { detail: 1 }); // the click a lifted finger makes
    expect(zoom()).toBeCloseTo(before + Math.log2(3), 1);
    expect(onStandSelect).not.toHaveBeenCalled();
    // The next tap on it is a tap again.
    fireEvent.pointerDown(stand(), finger(3, at));
    fireEvent.pointerUp(stand(), finger(3, at));
    fireEvent.click(stand(), { detail: 1 });
    expect(onStandSelect).toHaveBeenCalledTimes(1);
  });

  it('stops at the deepest and widest zoom the basemap allows', () => {
    renderMap();
    const spread = (from: number, to: number) =>
      pinch(
        [ground(), ground()],
        [
          [MID[0] - from, MID[1]],
          [MID[0] + from, MID[1]],
        ],
        [
          [MID[0] - to, MID[1]],
          [MID[0] + to, MID[1]],
        ],
      );
    for (let i = 0; i < 4; i++) spread(10, 400);
    expect(zoom()).toBe(VIEW_ZOOM.max);
    for (let i = 0; i < 6; i++) spread(400, 10);
    expect(zoom()).toBe(VIEW_ZOOM.min);
  });

  it('leaves a mouse alone: one pointer drags as before', () => {
    renderMap();
    const before = zoom();
    fireEvent.pointerDown(ground(), { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerDown(ground(), { clientX: 300, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(ground(), { clientX: 500, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(ground(), { clientX: 500, clientY: 100, pointerId: 1 });
    expect(zoom()).toBe(before);
  });
});

describe('double tap', () => {
  it('zooms one level in about the tap; a slow or far second tap does not', () => {
    renderMap();
    const before = zoom();
    const [sx, sy] = translateOf(stand());
    const at: Point = [200, 150];
    touchTap(at, 1000);
    touchTap([at[0] + 4, at[1] + 4], 1000 + mapChrome.gestures.doubleTapMs + 1);
    expect(zoom()).toBe(before);
    touchTap([at[0] + 100, at[1]], 3000);
    touchTap(at, 3000 + 150);
    expect(zoom()).toBe(before);
    touchTap(at, 5000);
    touchTap([at[0] + 3, at[1] - 3], 5000 + 200);
    expect(zoom()).toBeCloseTo(before + 1, 2);
    // About the (second) tap: the ground under it stayed put.
    const [x, y] = translateOf(stand());
    const tapped: Point = [at[0] + 3, at[1] - 3];
    expect(x).toBeCloseTo(tapped[0] + 2 * (sx - tapped[0]), 0);
    expect(y).toBeCloseTo(tapped[1] + 2 * (sy - tapped[1]), 0);
  });

  it('never zooms while taps draw: two quick taps are two taps', () => {
    const onMapClick = vi.fn();
    renderMap({ onMapClick });
    const before = zoom();
    touchTap([200, 150], 1000);
    touchTap([200, 150], 1100);
    expect(onMapClick).toHaveBeenCalledTimes(2);
    expect(zoom()).toBe(before);
  });
});

describe('the map owns every finger on it', () => {
  it('sets touch-action: none on the map container and every layer over it', () => {
    renderMap();
    const css = mapCss().replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, , body]) => /touch-action:\s*none/.test(body!))
      .map(([, selector]) => selector!.trim());
    const owned = (el: Element) => rules.some((selector) => el.matches(selector));
    const container = ground().closest('.plan')!;
    expect(owned(container)).toBe(true);
    const layers = [...container.querySelectorAll('.plan__svg')];
    // The ground and the stands' layer at least, and everything drawn on them.
    expect(layers.length).toBeGreaterThanOrEqual(2);
    for (const el of [...layers, ...container.querySelectorAll('.plan__svg *')])
      expect(owned(el)).toBe(true);
  });
});

describe('fitting the property for drawing', () => {
  it('fills an iPhone SE map with the property, its corners never closer than a 48 px target', () => {
    // An SE in portrait: the map between the app bar and the tab bar, under the edit pill, over the peek.
    const [width, height] = [375, 480];
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      width,
      height,
    } as DOMRect);
    const top = mapChrome.inset + mapChrome.pill.height + DRAW_PADDING;
    const footer = mapChrome.sheet.detents.peek;
    const map = (fit: Parameters<typeof ClubMap>[0]['fit']) => (
      <ClubMap
        {...SAMPLE_PLAN}
        label={LABEL}
        interactive
        editing
        insets={{ top, right: DRAW_PADDING, bottom: DRAW_PADDING, left: DRAW_PADDING }}
        footer={footer}
        fit={fit}
      />
    );
    // Laid out first, then the editor opens (as on the page).
    const { rerender } = render(map(null));
    rerender(map({ key: 'line', bounds: planBounds({ ...SAMPLE_PLAN, areas: [], stands: [] })! }));
    const d = ground().querySelector('.plan__line')!.getAttribute('d')!;
    const points = [...d.matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
    expect(points).toHaveLength(polygonRings(SAMPLE_PLAN.boundary)[0]!.length);
    const xs = points.map((p) => p[0]!);
    const ys = points.map((p) => p[1]!);
    const bottom = height - (footer + mapChrome.footer.height + mapChrome.inset);
    // Inside the open map, and filling it on the side that binds (here its height).
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(DRAW_PADDING - 0.5);
    expect(Math.max(...xs)).toBeLessThanOrEqual(width - DRAW_PADDING + 0.5);
    expect(Math.min(...ys)).toBeCloseTo(top, 0);
    expect(Math.max(...ys)).toBeCloseTo(bottom, 0);
    const corners = points.slice(0, -1);
    for (const [i, a] of corners.entries())
      for (const b of corners.slice(i + 1))
        expect(Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!)).toBeGreaterThanOrEqual(sizes.minTapTarget);
  });
});

describe('the edit pill on a phone', () => {
  it('may run the map\'s width while editing (the stack hides), so "Drawing property line" is whole', () => {
    expect(mapCss()).toMatch(
      /\.map-pill--edit \{[^}]*max-width: calc\(100% - 2 \* var\(--map-chrome-inset\)\); \}/,
    );
  });
});
