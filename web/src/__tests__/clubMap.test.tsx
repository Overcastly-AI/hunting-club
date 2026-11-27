import { BASEMAPS } from '@huntclub/shared';
import { render, screen } from '@testing-library/react';
import { ClubMap, FIT_PADDING } from '../map/ClubMap';
import { plateSide, PLATE_EDGE_ROOM } from '../map/plan';
import { SAMPLE_PLAN } from '../map/sampleProperty';
import { translateOf } from '../testing/mapPointer';

/** Lays every element out at `width` by `height` (jsdom has no layout). */
function laidOutAt(width: number, height: number) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width,
    height,
  } as DOMRect);
}
afterEach(() => vi.restoreAllMocks());

/** A stand's marker centre, from its group's translate(). */
const markerAt = translateOf;

/** Stands only (no line or areas), so the stands are the bounds the map fits. */
const WEST = {
  id: 'w',
  name: 'West Ladder',
  type: 'ladder' as const,
  lat: 40,
  lon: -90,
  active: true,
};
const EAST = {
  id: 'e',
  name: 'East Ridge Box Blind',
  type: 'ground_blind' as const,
  lat: 40.004,
  lon: -89.97,
  active: false,
};

function drawStands(width: number, height: number) {
  laidOutAt(width, height);
  render(<ClubMap areas={[]} stands={[WEST, EAST]} label="Stands" />);
  const map = screen.getByRole('img', { name: 'Stands' });
  return [...map.querySelectorAll('.plan__stand')];
}

describe('the club map', () => {
  it('fits what it draws to its bounds with 48 px of padding', () => {
    expect(FIT_PADDING).toBe(48);
    const [west, east] = drawStands(1000, 600).map(markerAt);
    // East-west is the tighter side here: the two stands sit exactly on the padding.
    expect(west![0]).toBeCloseTo(FIT_PADDING, 0);
    expect(east![0]).toBeCloseTo(1000 - FIT_PADDING, 0);
    for (const [, y] of [west!, east!]) {
      expect(y).toBeGreaterThanOrEqual(FIT_PADDING - 0.5);
      expect(y).toBeLessThanOrEqual(600 - FIT_PADDING + 0.5);
    }
  });

  it('puts a plate to the left of its stand where the right would cross the edge', () => {
    const [west, east] = drawStands(1000, 600);
    expect(west!.querySelector('.plan__plate-group--right')).toBeTruthy();
    expect(east!.querySelector('.plan__plate-group--left')).toBeTruthy();
    // The flipped plate ends left of the marker, inside the map.
    const plate = east!.querySelector('.plan__plate')!;
    const shift = Number(
      east!
        .querySelector('.plan__plate-group')!
        .getAttribute('transform')!
        .match(/translate\(([-\d.]+)/)![1],
    );
    expect(shift + Number(plate.getAttribute('width'))).toBeLessThan(0);
    expect(markerAt(east!)[0] + shift).toBeGreaterThanOrEqual(PLATE_EDGE_ROOM);
  });

  it('keeps stand names on a narrow map, and leaves area names to wider ones', () => {
    laidOutAt(390, 320);
    render(<ClubMap {...SAMPLE_PLAN} label="Narrow" />);
    const map = screen.getByRole('img', { name: 'Narrow' });
    expect([...map.querySelectorAll('.plan__plate-name')].map((t) => t.textContent)).toEqual(
      SAMPLE_PLAN.stands.map((s) => s.name),
    );
    expect(map.querySelectorAll('.plan__label')).toHaveLength(0);
    // Every plate stays on the map.
    for (const stand of map.querySelectorAll('.plan__stand')) {
      const [x] = markerAt(stand);
      const group = stand.querySelector('.plan__plate-group')!;
      const shift = Number(group.getAttribute('transform')!.match(/translate\(([-\d.]+)/)![1]);
      const width = Number(group.querySelector('.plan__plate')!.getAttribute('width'));
      expect(x + shift).toBeGreaterThanOrEqual(0);
      expect(x + shift + width).toBeLessThanOrEqual(390);
    }
  });

  it('small maps beside a list (compact) leave every name to the list', () => {
    laidOutAt(1000, 600);
    render(<ClubMap {...SAMPLE_PLAN} compact label="Inset" />);
    const map = screen.getByRole('img', { name: 'Inset' });
    expect(map.querySelectorAll('.plan__plate')).toHaveLength(0);
    expect(map.querySelectorAll('.plan__label')).toHaveLength(0);
  });

  it("draws the club's map pack under the plan, with its credit, instead of the grid", () => {
    laidOutAt(1000, 600);
    const tile = {
      key: '16/1/1',
      bounds: [-90, 40, -89.99, 40.01] as const,
      href: 'data:image/jpeg;base64,AA==',
    };
    const { rerender } = render(<ClubMap {...SAMPLE_PLAN} label="Plan" />);
    const map = () => screen.getByRole('img', { name: 'Plan' });
    expect(map().querySelector('.plan__grid')).toBeTruthy();
    expect(map().querySelectorAll('image')).toHaveLength(0);
    rerender(
      <ClubMap
        {...SAMPLE_PLAN}
        label="Plan"
        basemap={{ basemap: BASEMAPS.aerial, tiles: [{ ...tile, bounds: [...tile.bounds] }] }}
      />,
    );
    const image = map().querySelector('image')!;
    expect(image.getAttribute('href')).toBe(tile.href);
    expect(Number(image.getAttribute('width'))).toBeGreaterThan(0);
    expect(map().querySelector('.plan__grid')).toBeNull();
    expect(map().querySelector('.plan__credit')!.textContent).toBe(BASEMAPS.aerial.credit);
    // The picture is under everything else.
    const order = [...map().querySelectorAll('.plan__basemap, .plan__line, .plan__stand')];
    expect(order[0]!.classList.contains('plan__basemap')).toBe(true);
  });
});

describe('plateSide', () => {
  it('is right unless that crosses the edge and the left fits; then the side with more room', () => {
    expect(plateSide(100, 25, 120, 1000)).toBe('right');
    expect(plateSide(900, 25, 120, 1000)).toBe('left');
    // Exactly at the edge room still fits on the right.
    expect(plateSide(1000 - PLATE_EDGE_ROOM - 145, 25, 120, 1000)).toBe('right');
    // Too wide for either side of a narrow map.
    expect(plateSide(60, 25, 300, 200)).toBe('right');
    expect(plateSide(150, 25, 300, 200)).toBe('left');
  });
});
