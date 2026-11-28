// My club's map chrome (docs/DESIGN.md "Map chrome"): the top pill, the icon stack and its
// Layers popover, auto-hide, the bottom sheet and the desktop panel. Coverage itself is measured
// on real layout by scripts/shoot.ts; jsdom lays nothing out.
import { mapChrome } from '@huntclub/design';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderSignedIn } from '../testing/app';
import { ground, usePointerEvents } from '../testing/mapPointer';

usePointerEvents();

/** Every element laid out at a phone's map size (the map between the top bar and the tab bar). */
const phone = () =>
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 390,
    height: 724,
    left: 0,
    top: 0,
  } as DOMRect);

const sheet = () => screen.getByRole('region', { name: 'Club panel' });
const detentOf = () =>
  ['peek', 'half', 'full'].find((d) => sheet().classList.contains(`map-sheet--${d}`));
const plan = () => ground().closest('.plan')!;

describe('the top pill', () => {
  it("names the club as the page's heading, with the next time, and drops the conditions card", async () => {
    await renderSignedIn();
    const heading = screen.getByRole('heading', { level: 1, name: 'Oak Ridge Hunt Club' });
    const pill = heading.closest('.map-pill')!;
    expect(pill.querySelector('.map-pill__next')!.textContent).toMatch(
      /until sunset|Overdue at \d|Sunset \d/,
    );
    expect(pill.textContent).not.toMatch(/shooting|first light|last light/i);
    const toggle = within(pill as HTMLElement).getByRole('button', {
      name: 'Today at the property',
    });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(
      within(pill as HTMLElement).getByRole('list', { name: 'Conditions today' }),
    ).toBeTruthy();
    // Esc closes it and gives focus back.
    fireEvent.keyDown(toggle, { key: 'Escape' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });
});

describe('the icon stack', () => {
  it('is icon buttons with names: Layers, the split zoom and Find me', async () => {
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition: vi.fn() } });
    await renderSignedIn();
    const stack = within(screen.getByRole('group', { name: 'Map controls' }));
    for (const name of ['Layers', 'Zoom in', 'Zoom out', 'Find me']) {
      const button = stack.getByRole('button', { name });
      expect(button.getAttribute('aria-label')).toBe(name);
      expect(button.textContent).toBe('');
    }
    // No labelled tray and no basemap buttons on the map itself.
    expect(stack.queryByRole('radio')).toBeNull();
    expect(stack.queryByRole('button', { name: 'Fit property' })).toBeNull();
  });

  it('opens Layers: the basemap, show or hide stands and areas, Fit property and the property line', async () => {
    await renderSignedIn();
    fireEvent.click(screen.getByRole('button', { name: 'Layers' }));
    const layers = within(screen.getByRole('group', { name: 'Map layers' }));
    expect(layers.getByRole('radio', { name: 'Aerial' })).toBeTruthy();
    expect(layers.getByRole('button', { name: 'Fit property' })).toBeTruthy();
    expect(layers.getByRole('link', { name: 'Map packs' })).toBeTruthy();
    const stands = () => screen.queryByRole('group', { name: 'Stands' });
    expect(stands()!.querySelectorAll('.plan__stand')).toHaveLength(3);
    fireEvent.click(layers.getByRole('switch', { name: 'Stands' }));
    expect(stands()!.querySelectorAll('.plan__stand')).toHaveLength(0);
    fireEvent.click(layers.getByRole('switch', { name: 'Areas' }));
    expect(ground().querySelectorAll('.plan__area')).toHaveLength(0);
    fireEvent.click(layers.getByRole('button', { name: 'Edit property line' }));
    expect(screen.getByRole('group', { name: 'Property line corners' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Map layers' })).toBeNull();
  });
});

describe('auto-hide', () => {
  afterEach(() => vi.useRealTimers());

  it('fades the chrome while the map moves and brings it back after 1.5 s still, or on a tap', async () => {
    await renderSignedIn();
    vi.useFakeTimers();
    fireEvent.keyDown(ground(), { key: 'ArrowLeft' });
    expect(plan().classList.contains('plan--moving')).toBe(true);
    // The pill, the stack and the footer line fade; the sheet is outside the map and never does.
    for (const piece of ['.map-pill', '.map-stack', '.plan__footer'])
      expect(plan().querySelector(piece)!.classList.contains('map-fade')).toBe(true);
    expect(sheet().closest('.plan')).toBeNull();
    act(() => vi.advanceTimersByTime(mapChrome.autoHide.idleMs - 1));
    expect(plan().classList.contains('plan--moving')).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(plan().classList.contains('plan--moving')).toBe(false);
    // A tap brings it back at once.
    fireEvent.keyDown(ground(), { key: '+' });
    expect(plan().classList.contains('plan--moving')).toBe(true);
    fireEvent.pointerDown(ground(), { clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(ground(), { clientX: 50, clientY: 50, pointerId: 1 });
    expect(plan().classList.contains('plan--moving')).toBe(false);
  });
});

describe('the bottom sheet (phones and tablets)', () => {
  it('peeks with what the club holds, and moves between peek, half and full', async () => {
    phone();
    await renderSignedIn();
    expect(detentOf()).toBe('peek');
    expect(within(sheet()).getByText('640 acres, 3 stands, 2 areas')).toBeTruthy();
    const more = within(sheet()).getByRole('button', { name: 'Show more' });
    fireEvent.click(more);
    expect(detentOf()).toBe('half');
    fireEvent.click(more);
    expect(detentOf()).toBe('full');
    const less = within(sheet()).getByRole('button', { name: 'Show less' });
    fireEvent.keyDown(less, { key: 'ArrowDown' });
    expect(detentOf()).toBe('half');
    fireEvent.keyDown(within(sheet()).getByRole('button', { name: 'Show more' }), {
      key: 'ArrowDown',
    });
    expect(detentOf()).toBe('peek');
  });

  it('follows a drag of its handle zone and settles on a detent', async () => {
    phone();
    await renderSignedIn();
    const handle = sheet().querySelector('.map-sheet__handle')!;
    fireEvent.pointerDown(handle, { clientX: 200, clientY: 690, pointerId: 4 });
    fireEvent.pointerMove(handle, { clientX: 200, clientY: 500, pointerId: 4 });
    expect(sheet().classList.contains('map-sheet--dragging')).toBe(true);
    fireEvent.pointerMove(handle, { clientX: 200, clientY: 380, pointerId: 4 });
    fireEvent.pointerUp(handle, { clientX: 200, clientY: 380, pointerId: 4 });
    expect(sheet().classList.contains('map-sheet--dragging')).toBe(false);
    expect(detentOf()).toBe('half');
  });

  it('rises when focus moves into it, so nothing focused is out of sight', async () => {
    phone();
    await renderSignedIn();
    expect(detentOf()).toBe('peek');
    // Add stand shows once the club's places have loaded (after the heading): wait for it.
    (await within(sheet()).findByRole('button', { name: 'Add stand' })).focus();
    await waitFor(() => expect(detentOf()).toBe('half'));
  });
});

describe('on a desktop', () => {
  it('keeps the side panel with the conditions in it, and the pill shows only the name and the next time', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    );
    await renderSignedIn();
    const panel = within(screen.getByRole('complementary', { name: 'Club panel' }));
    expect(panel.getByRole('heading', { level: 2, name: 'Today' })).toBeTruthy();
    expect(panel.getByRole('list', { name: 'Conditions today' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Club panel' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Today at the property' })).toBeNull();
  });
});
