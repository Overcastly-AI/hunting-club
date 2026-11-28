import { BASEMAPS } from '@huntclub/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { mapChrome, PLATE_EDGE_ROOM } from '@huntclub/design';
import { ClubMap, FIT_PADDING } from '../map/ClubMap';
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

  it('puts a label to the left of its stand where the right would cross the edge', () => {
    const [west, east] = drawStands(1000, 600);
    const { marker, gap, text } = mapChrome.labels;
    // No box: the name alone, 6 px from the 32 px marker's edge (past its halo).
    expect(west!.querySelector('.plan__plate, .plan__stand-label rect')).toBeNull();
    const right = west!.querySelector('.plan__stand-label--right')!;
    expect(Number(right.getAttribute('x'))).toBeCloseTo(marker / 2 + gap + text.halo, 1);
    expect(Number(west!.querySelector('.plan__stand-box')!.getAttribute('width'))).toBe(marker);
    // The flipped label ends left of the marker, inside the map.
    const left = east!.querySelector('.plan__stand-label--left')!;
    const x = Number(left.getAttribute('x')) - text.halo;
    const width = Number(left.getAttribute('data-width'));
    expect(x + width).toBeCloseTo(-(marker / 2 + gap), 1);
    expect(markerAt(east!)[0] + x).toBeGreaterThanOrEqual(PLATE_EDGE_ROOM);
  });

  it('collapses stand names to icons below the label zoom, and leaves area names to wider maps', () => {
    laidOutAt(390, 320);
    render(<ClubMap {...SAMPLE_PLAN} label="Narrow" />);
    const map = screen.getByRole('img', { name: 'Narrow' });
    // The whole property on a small map is below the label zoom: icons only.
    expect(map.querySelectorAll('.plan__stand')).toHaveLength(SAMPLE_PLAN.stands.length);
    expect(map.querySelectorAll('.plan__stand-label')).toHaveLength(0);
    expect(map.querySelectorAll('.plan__label')).toHaveLength(0);
  });

  it('hides stand names below zoom 15 and shows them from it, as the map zooms', () => {
    laidOutAt(1000, 600);
    render(<ClubMap areas={[]} stands={[WEST, EAST]} label="Zooming" interactive />);
    const map = screen.getByRole('img', { name: /^Zooming/ });
    const zoom = () => Number(map.getAttribute('data-zoom'));
    const names = () => map.querySelectorAll('.plan__stand-label').length;
    const key = (k: string) => fireEvent.keyDown(map, { key: k });
    // Out until below the label zoom, then in, a level at a time, checking each side of it.
    while (zoom() >= mapChrome.labels.minZoom) key('-');
    for (let i = 0; i < 6; i++) {
      expect(names()).toBe(zoom() < mapChrome.labels.minZoom ? 0 : 2);
      key('+');
    }
    expect(zoom()).toBeGreaterThanOrEqual(mapChrome.labels.minZoom);
    expect(names()).toBe(2);
    while (zoom() >= mapChrome.labels.minZoom) key('-');
    expect(names()).toBe(0);
  });

  it('caps every stand label at 140 px, cutting a long name, within the 32 px label height', () => {
    const stands = drawStands(1000, 600);
    for (const stand of stands) {
      const label = stand.querySelector('.plan__stand-label')!;
      expect(Number(label.getAttribute('data-width'))).toBeLessThanOrEqual(
        mapChrome.labels.maxWidth,
      );
    }
    expect(mapChrome.labels.text.size + 2 * mapChrome.labels.text.halo).toBeLessThanOrEqual(
      mapChrome.labels.maxHeight,
    );
    const names = stands.map((s) => s.querySelector('.plan__stand-label')!.textContent!);
    expect(names[0]).toBe(WEST.name);
    expect(names[1]).toMatch(/^East Ridge .*…$/);
  });

  it('small maps beside a list (compact) leave every name to the list', () => {
    laidOutAt(1000, 600);
    render(<ClubMap {...SAMPLE_PLAN} compact label="Inset" />);
    const map = screen.getByRole('img', { name: 'Inset' });
    expect(map.querySelectorAll('.plan__stand-label')).toHaveLength(0);
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
