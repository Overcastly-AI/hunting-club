import {
  BASEMAPS,
  ClubApiRequestError,
  PROPERTY_LINE_PROBLEMS,
  propertyLineProblem,
  tileUrl,
  USGS_MAX_TILE_ZOOM,
  type Polygon,
} from '@huntclub/shared';
import { SAMPLE_PROPERTY } from '@huntclub/shared/sample';
import { mapChrome } from '@huntclub/design';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { liveBasemap } from '../map/basemap';
import { ClubMap } from '../map/ClubMap';
import { canClose, drawProblem, drawReducer, startDrawing, type DrawState } from '../map/draw';
import { DEFAULT_VIEW, panView, viewProjection, zoomView } from '../map/plan';
import { SAMPLE_PLAN } from '../map/sampleProperty';
import { renderSignedIn } from '../testing/app';
import { sampleData } from '../testing/fakeClubApi';
import { ground, MAP_H, MAP_W, tap, translateOf, usePointerEvents } from '../testing/mapPointer';

usePointerEvents();

const W = MAP_W;
const H = MAP_H;

const lonLat = (x: number, y: number) =>
  viewProjection({ lon: -90, lat: 40, zoom: 16 }, W, H).unproject(x, y);
/** A 300 px square's corners at zoom 16 (about 64 acres at 40° N), clockwise from top left. */
const SQUARE = [lonLat(330, 170), lonLat(630, 170), lonLat(630, 470), lonLat(330, 470)];

const drawn = (...corners: [number, number][]) =>
  corners.reduce<DrawState>((s, at) => drawReducer(s, { type: 'add', at }), startDrawing());

describe('drawing state', () => {
  it('adds corners, closes the shape, moves a corner and undoes each step', () => {
    let state = drawn(...SQUARE);
    expect(state.corners).toHaveLength(4);
    expect(state.selected).toBe(3);
    expect(canClose(state)).toBe(true);
    expect(drawProblem(state)).toBe('open');
    state = drawReducer(state, { type: 'close' });
    expect(state.closed).toBe(true);
    expect(drawProblem(state)).toBeNull();
    // Closed: a tap on the map adds nothing.
    expect(drawReducer(state, { type: 'add', at: lonLat(10, 10) })).toBe(state);
    const moved = drawReducer(state, {
      type: 'move',
      index: 1,
      to: lonLat(700, 100),
      record: true,
    });
    expect(moved.corners[1]).toEqual(lonLat(700, 100));
    // A drag records once, at its start: one Undo puts the corner back.
    const dragged = drawReducer(moved, {
      type: 'move',
      index: 1,
      to: lonLat(720, 90),
      record: false,
    });
    expect(drawReducer(dragged, { type: 'undo' }).corners).toEqual(state.corners);
    // Undo walks back through closing and every corner.
    let back = drawReducer(state, { type: 'undo' });
    expect(back.closed).toBe(false);
    for (let i = 0; i < 4; i++) back = drawReducer(back, { type: 'undo' });
    expect(back.corners).toEqual([]);
    expect(drawReducer(back, { type: 'undo' })).toBe(back);
  });

  it('removes a corner, opening the shape when too few are left', () => {
    let state = drawReducer(drawn(...SQUARE.slice(0, 3)), { type: 'close' });
    state = drawReducer(state, { type: 'remove', index: 0 });
    expect(state.corners).toEqual(SQUARE.slice(1, 3));
    expect(state.closed).toBe(false);
    expect(canClose(state)).toBe(false);
    expect(drawReducer(state, { type: 'close' })).toBe(state);
  });

  it("starts from the club's line, closed, and refuses a shape the shared rule refuses", () => {
    const state = startDrawing(SAMPLE_PROPERTY.boundary);
    expect(state.closed).toBe(true);
    expect(state.corners).toHaveLength(6);
    expect(drawProblem(state)).toBeNull();
    const bowTie = drawReducer(drawn(SQUARE[0]!, SQUARE[2]!, SQUARE[1]!, SQUARE[3]!), {
      type: 'close',
    });
    expect(drawProblem(bowTie)).toBe('crosses');
    expect(drawProblem(bowTie)).toBe(
      propertyLineProblem({
        type: 'Polygon',
        coordinates: [[...bowTie.corners, bowTie.corners[0]!]],
      }),
    );
  });
});

describe('the map view', () => {
  it('pans with the ground under the pointer and zooms around a point', () => {
    const view = { lon: -90, lat: 40, zoom: 14 };
    const p = viewProjection(view, W, H);
    const [x, y] = p.project(-90.01, 40.01);
    const panned = viewProjection(panView(view, 50, -20), W, H).project(-90.01, 40.01);
    expect(panned[0]).toBeCloseTo(x + 50, 6);
    expect(panned[1]).toBeCloseTo(y - 20, 6);
    const zoomed = zoomView(view, 1, W, H, [100, 100]);
    expect(zoomed.zoom).toBe(15);
    const under = viewProjection(zoomed, W, H).project(...p.unproject(100, 100));
    expect(under[0]).toBeCloseTo(100, 6);
    expect(under[1]).toBeCloseTo(100, 6);
    // Never past the deepest or widest view.
    expect(zoomView({ ...view, zoom: 20 }, 3, W, H).zoom).toBe(20);
    expect(zoomView({ ...view, zoom: 3 }, -3, W, H).zoom).toBe(3);
  });
});

describe('live basemap tiles', () => {
  it('cover the view with the shared USGS template at the nearest whole tile zoom', () => {
    const projection = viewProjection({ lon: -90, lat: 40, zoom: 14.4 }, W, H);
    const { basemap, tiles } = liveBasemap('aerial', projection, W, H);
    expect(basemap).toBe(BASEMAPS.aerial);
    expect(tiles.length).toBeGreaterThan(4);
    for (const tile of tiles) {
      const [z, x, y] = tile.key.split('/').slice(1).map(Number) as [number, number, number];
      expect(z).toBe(14);
      expect(tile.href).toBe(tileUrl('aerial', z, x, y));
      expect(tile.href.startsWith(BASEMAPS.aerial.tileUrl.split('{z}')[0]!)).toBe(true);
    }
    // Past the deepest cached level, the deepest tiles are drawn larger.
    const deep = liveBasemap('topo', viewProjection({ lon: -90, lat: 40, zoom: 19 }, W, H), W, H);
    expect(deep.tiles.every((t) => t.key.startsWith(`topo/${USGS_MAX_TILE_ZOOM}/`))).toBe(true);
  });

  it('render under the plan, switch basemap, and follow the zoom buttons', () => {
    function Map() {
      const [live, setLive] = useState<'topo' | 'aerial'>('aerial');
      return (
        <ClubMap {...SAMPLE_PLAN} label="Club" interactive live={live} onLiveChange={setLive} />
      );
    }
    render(<Map />);
    const map = screen.getByRole('img', { name: /^Club/ });
    const hrefs = () =>
      [...map.querySelectorAll('.plan__basemap--live image')].map((i) => i.getAttribute('href')!);
    expect(hrefs().length).toBeGreaterThan(0);
    const template = (id: 'topo' | 'aerial') =>
      new RegExp(`^${BASEMAPS[id].tileUrl.replace(/[.]/g, '\\.').replace(/\{[zxy]\}/g, '\\d+')}$`);
    for (const href of hrefs()) expect(href).toMatch(template('aerial'));
    expect(map.querySelector('.plan__credit')!.textContent).toBe(BASEMAPS.aerial.credit);
    // The basemap is in the Layers popover, on the icon stack.
    fireEvent.click(screen.getByRole('button', { name: 'Layers' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Topo' }));
    for (const href of hrefs()) expect(href).toMatch(template('topo'));
    expect(map.querySelector('.plan__credit')!.textContent).toBe(BASEMAPS.topo.credit);
    const zoomOf = () => Number(hrefs()[0]!.match(/tile\/(\d+)\//)![1]);
    const before = zoomOf();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(zoomOf()).toBe(before - 1);
    fireEvent.keyDown(map, { key: '+' });
    expect(zoomOf()).toBe(before);
  });

  it('starts over the lower 48 when there is nothing to fit', () => {
    render(<ClubMap areas={[]} stands={[]} label="Empty" interactive live="topo" />);
    const map = screen.getByRole('img', { name: /^Empty/ });
    const z = Math.round(DEFAULT_VIEW.zoom);
    expect(map.querySelector('.plan__basemap--live image')!.getAttribute('href')).toMatch(
      new RegExp(`/tile/${z}/`),
    );
  });
});

const corners = () => within(screen.getByRole('group', { name: 'Property line corners' }));
const cornerAt = translateOf;

/** My club for a club with no property line yet, zoomed in to about 2 m per px. */
async function noLineYet() {
  const data = sampleData();
  const { boundary: _none, ...club } = data.club!;
  const view = await renderSignedIn({ ...data, club, areas: [], stands: [] });
  for (let i = 0; i < 12; i++) fireEvent.keyDown(ground(), { key: '+' });
  const save = vi.spyOn(view.client, 'updateClub');
  fireEvent.click(await screen.findByRole('button', { name: 'Draw property line' }));
  return { ...view, save, data };
}

describe('drawing the property line on My club', () => {
  it('adds corners by tap, drags one, undoes, closes the shape and saves it through the club API', async () => {
    const { save } = await noLineYet();
    tap(330, 170);
    tap(630, 170);
    tap(630, 470);
    expect(corners().getAllByRole('button')).toHaveLength(3);
    // A press that drags moves the map, not a new corner.
    fireEvent.pointerDown(ground(), { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(ground(), { clientX: 110, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(ground(), { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(ground(), { clientX: 100, clientY: 100, pointerId: 1 });
    expect(corners().getAllByRole('button')).toHaveLength(3);
    tap(330, 470);
    const fourth = corners().getByRole('button', { name: 'Corner 4 of 4' });
    // Drag the fourth corner 40 px right, then Undo puts it back.
    const [x, y] = cornerAt(fourth);
    fireEvent.pointerDown(fourth, { clientX: x, clientY: y, pointerId: 2 });
    fireEvent.pointerMove(fourth, { clientX: x + 20, clientY: y, pointerId: 2 });
    fireEvent.pointerMove(fourth, { clientX: x + 40, clientY: y, pointerId: 2 });
    fireEvent.pointerUp(fourth, { clientX: x + 40, clientY: y, pointerId: 2 });
    expect(cornerAt(corners().getByRole('button', { name: 'Corner 4 of 4' }))[0]).toBeCloseTo(
      x + 40,
      0,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(cornerAt(corners().getByRole('button', { name: 'Corner 4 of 4' }))[0]).toBeCloseTo(x, 0);
    // Tapping the first corner closes the shape.
    const first = corners().getByRole('button', { name: 'Corner 1 of 4, closes the shape' });
    fireEvent.pointerDown(first, { clientX: 330, clientY: 170, pointerId: 3 });
    fireEvent.pointerUp(first, { clientX: 330, clientY: 170, pointerId: 3 });
    expect(screen.queryByRole('button', { name: 'Close shape' })).toBeNull();
    expect(document.querySelector('.draw__count')!.textContent).toMatch(/^4 corners, \d+ acres$/);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const [, patch] = save.mock.calls[0]!;
    const boundary = patch.boundary as Polygon;
    expect(boundary.type).toBe('Polygon');
    expect((boundary.coordinates[0] as unknown[]).length).toBe(5);
    expect(propertyLineProblem(boundary)).toBeNull();
    // Saved: the line is the club's, and the panel offers to edit it.
    expect(await screen.findByRole('button', { name: 'Edit property line' })).toBeTruthy();
    expect(ground().querySelectorAll('.plan__line')).toHaveLength(1);
    expect(screen.queryByText(/^Draw your property line/)).toBeNull();
  });

  it('draws from the keyboard: Add corner at the cross, arrows move the selected corner, Delete removes it', async () => {
    const { save } = await noLineYet();
    const add = () => fireEvent.click(screen.getByRole('button', { name: 'Add corner' }));
    add();
    fireEvent.keyDown(ground(), { key: 'ArrowLeft', shiftKey: true }); // the map moves 640 px
    add();
    fireEvent.keyDown(ground(), { key: 'ArrowUp', shiftKey: true });
    add();
    expect(corners().getAllByRole('button')).toHaveLength(3);
    const third = corners().getByRole('button', { name: 'Corner 3 of 3' });
    third.focus();
    const [x, y] = cornerAt(third);
    fireEvent.keyDown(third, { key: 'ArrowRight' });
    fireEvent.keyDown(third, { key: 'ArrowDown', shiftKey: true });
    const [x2, y2] = cornerAt(corners().getByRole('button', { name: 'Corner 3 of 3' }));
    expect(x2).toBeCloseTo(x + 4, 0);
    expect(y2).toBeCloseTo(y + 40, 0);
    fireEvent.keyDown(corners().getByRole('button', { name: 'Corner 3 of 3' }), { key: 'Delete' });
    expect(corners().getAllByRole('button')).toHaveLength(2);
    expect(
      (screen.getByRole('button', { name: 'Close shape' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    add();
    fireEvent.click(screen.getByRole('button', { name: 'Close shape' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  });

  it('refuses a line that crosses itself, with the shared words, and sends nothing', async () => {
    const { save } = await noLineYet();
    // A bow tie: the second and third sides cross.
    tap(330, 170);
    tap(630, 470);
    tap(630, 170);
    tap(330, 470);
    fireEvent.click(screen.getByRole('button', { name: 'Close shape' }));
    expect(screen.getByText(PROPERTY_LINE_PROBLEMS.crosses)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect((await screen.findByRole('alert')).textContent).toBe(PROPERTY_LINE_PROBLEMS.crosses);
    // Said once, not once as what is still needed and again as the error.
    expect(screen.getAllByText(PROPERTY_LINE_PROBLEMS.crosses)).toHaveLength(1);
    expect(save).not.toHaveBeenCalled();
    // An open shape says how to finish it.
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('alert').textContent).toMatch(/^Close the shape to save it/);
    expect(save).not.toHaveBeenCalled();
  });

  it('cancels with nothing saved, back to the club pill', async () => {
    const { save } = await noLineYet();
    tap(330, 170);
    tap(630, 170);
    tap(630, 470);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(save).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Property line corners' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Draw property line' })).toBeTruthy();
    expect(document.querySelector('.map-pill:not(.map-pill--edit)')).toBeTruthy();
    expect(ground().querySelectorAll('.plan__line')).toHaveLength(0);
  });

  it("edits the club's own line where it lies, without moving the map", async () => {
    const view = await renderSignedIn();
    const edit = await screen.findByRole('button', { name: 'Edit property line' });
    const line = ground().querySelector('.plan__line')!.getAttribute('d')!;
    const [x0, y0] = line
      .match(/^M([-\d.]+) ([-\d.]+)/)!
      .slice(1)
      .map(Number) as [number, number];
    const save = vi.spyOn(view.client, 'updateClub');
    fireEvent.click(edit);
    // The line is closed and its corners sit where it was drawn.
    expect(corners().getAllByRole('button')).toHaveLength(
      SAMPLE_PROPERTY.boundary.coordinates[0]!.length - 1,
    );
    const [x, y] = cornerAt(corners().getByRole('button', { name: /^Corner 1 of 6/ }));
    expect(x).toBeCloseTo(x0, 0);
    expect(y).toBeCloseTo(y0, 0);
    expect(screen.queryByRole('button', { name: 'Close shape' })).toBeNull();
    // Remove a corner of the L: still a good line, saved without it.
    fireEvent.keyDown(corners().getByRole('button', { name: /^Corner 4 of 6/ }), { key: 'Delete' });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect((save.mock.calls[0]![1].boundary as Polygon).coordinates[0]).toHaveLength(6);
  });

  it("edits the club's line from the Needs you row too, and says why the club service refused a save", async () => {
    const data = sampleData();
    const { boundary: _none, ...club } = data.club!;
    const view = await renderSignedIn({ ...data, club, areas: [], stands: [] });
    const needs = (await screen.findByRole('heading', { level: 2, name: /^Needs you/ })).closest(
      'section',
    )!;
    const row = within(needs)
      .getByText(/^Draw your property line/)
      .closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Draw' }));
    expect(screen.getByRole('group', { name: 'Property line corners' })).toBeTruthy();
    for (let i = 0; i < 12; i++) fireEvent.keyDown(ground(), { key: '+' });
    tap(330, 170);
    tap(630, 170);
    tap(630, 470);
    fireEvent.click(screen.getByRole('button', { name: 'Close shape' }));
    vi.spyOn(view.client, 'updateClub').mockRejectedValueOnce(
      new ClubApiRequestError('network', 0),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect((await screen.findByRole('alert')).textContent).toBe(
      'No connection. Try again when you are online.',
    );
    // Still drawing: nothing is lost.
    expect(corners().getAllByRole('button')).toHaveLength(3);
  });
});

describe('drawing is its own mode', () => {
  it('hides the icon stack, puts Done and Cancel in the pill and the tools on the draw bar in the sheet', async () => {
    // Every element laid out at a phone's map size.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 390,
      height: 724,
      left: 0,
      top: 0,
    } as DOMRect);
    const { save } = await noLineYet();
    expect(screen.queryByRole('group', { name: 'Map controls' })).toBeNull();
    const pill = within(screen.getByRole('group', { name: 'Drawing property line' }));
    expect(pill.getByRole('button', { name: 'Done' })).toBeTruthy();
    expect(pill.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    // The draw bar is the sheet's one line, so it shows at the peek.
    const sheet = screen.getByRole('region', { name: 'Club panel' });
    const bar = within(within(sheet).getByRole('group', { name: 'Drawing the property line' }));
    expect(bar.getByText('0 corners')).toBeTruthy();
    expect(sheet.querySelector('.map-sheet__handle .draw-bar')).toBeTruthy();
    expect(sheet.classList.contains('map-sheet--peek')).toBe(true);
    // The footer line (scale bar and credit) rides the sheet, its clearance above the peek.
    const footer = ground().querySelector('.plan__footer')!.getAttribute('transform')!;
    const lift = parseFloat(sheet.parentElement!.style.getPropertyValue('--map-footer-lift'));
    expect(lift).toBe(mapChrome.sheet.detents.peek);
    expect(Number(footer.match(/ ([-\d.]+)\)$/)![1]) - lift).toBeLessThanOrEqual(
      724 - mapChrome.sheet.detents.peek - mapChrome.footer.clearance,
    );
    // Draw from the keyboard with the bar's tools.
    const add = () => fireEvent.click(bar.getByRole('button', { name: 'Add corner' }));
    add();
    fireEvent.keyDown(ground(), { key: 'ArrowLeft', shiftKey: true });
    add();
    fireEvent.keyDown(ground(), { key: 'ArrowUp', shiftKey: true });
    add();
    expect(bar.getByText('3 corners')).toBeTruthy();
    fireEvent.click(bar.getByRole('button', { name: 'Close shape' }));
    expect(document.querySelector('.draw-bar .draw__count')!.textContent).toMatch(
      /^3 corners, \d+ acres$/,
    );
    fireEvent.click(pill.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    // Saved: the pill and the stack are back.
    expect(await screen.findByRole('group', { name: 'Map controls' })).toBeTruthy();
  });

  it('raises the sheet to show what to fix when Done is refused', async () => {
    await noLineYet();
    tap(330, 170);
    tap(630, 170);
    tap(630, 470);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('alert').textContent).toMatch(/^Close the shape to save it/);
    expect(
      screen.getByRole('region', { name: 'Club panel' }).classList.contains('map-sheet--half'),
    ).toBe(true);
  });
});
