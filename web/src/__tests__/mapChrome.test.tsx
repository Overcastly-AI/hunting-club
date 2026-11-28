// My club's map chrome (docs/DESIGN.md "Map chrome"): the top pill, the icon stack and its
// Layers popover, auto-hide, the bottom sheet and the desktop panel. Coverage itself is measured
// on real layout by scripts/shoot.ts; jsdom lays nothing out.
import { mapChrome } from '@huntclub/design';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { BASEMAP_STORAGE_KEY, storedBasemap } from '../map/basemap';
import { renderSignedIn } from '../testing/app';
import { ADD_MENU, ground, usePointerEvents } from '../testing/mapPointer';

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

/** On a desktop (from the desktop breakpoint): the side panel, not the sheet. */
const desktop = () =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} })),
  );

describe('the top pill', () => {
  it('shows only the next time (the app bar names the club) and drops the conditions card', async () => {
    await renderSignedIn();
    // The club's name is the page's heading for screen readers, not on the pill.
    const heading = screen.getByRole('heading', { level: 1, name: 'Oak Ridge Hunt Club' });
    expect(heading.classList.contains('visually-hidden')).toBe(true);
    const pill = plan().querySelector('.map-pill')!;
    expect(pill.textContent).not.toContain('Oak Ridge Hunt Club');
    expect(pill.querySelector('.map-pill__next')!.textContent).toMatch(
      /^(\d+ h )?\d+ min until sunset|^Overdue at \d|^Sunset \d/,
    );
    expect(pill.textContent).not.toMatch(/shooting|first light|last light/i);
    const toggle = within(pill as HTMLElement).getByRole('button', {
      name: /^Today at the property, /,
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

  it('opens Layers beside the stack with only the basemap, stands and areas, and Fit property', async () => {
    await renderSignedIn();
    fireEvent.click(screen.getByRole('button', { name: 'Layers' }));
    const panel = screen.getByRole('group', { name: 'Map layers' });
    const layers = within(panel);
    // To the left of the stack, so it never covers the stack or Find me.
    expect(panel.classList.contains('ui-popover__panel--left-start')).toBe(true);
    expect(
      layers.getAllByRole('radio').map((r) => r.getAttribute('aria-label') ?? r.textContent),
    ).toHaveLength(2);
    expect(layers.getByRole('radio', { name: 'Aerial' })).toBeTruthy();
    expect(layers.getAllByRole('switch')).toHaveLength(2);
    expect(layers.getAllByRole('button').map((b) => b.textContent)).toEqual(['Fit property']);
    expect(layers.queryByRole('link')).toBeNull();
    expect(panel.textContent).not.toMatch(/Map pack|property line/);
    const stands = () => screen.queryByRole('group', { name: 'Stands' });
    expect(stands()!.querySelectorAll('.plan__stand')).toHaveLength(3);
    fireEvent.click(layers.getByRole('switch', { name: 'Stands' }));
    expect(stands()!.querySelectorAll('.plan__stand')).toHaveLength(0);
    fireEvent.click(layers.getByRole('switch', { name: 'Areas' }));
    expect(ground().querySelectorAll('.plan__area')).toHaveLength(0);
  });

  it('closes Layers on a tap on the map and on Esc', async () => {
    await renderSignedIn();
    const open = () => fireEvent.click(screen.getByRole('button', { name: 'Layers' }));
    const isOpen = () => screen.queryByRole('group', { name: 'Map layers' }) !== null;
    open();
    expect(isOpen()).toBe(true);
    fireEvent.pointerDown(ground(), { clientX: 300, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(ground(), { clientX: 300, clientY: 300, pointerId: 1 });
    expect(isOpen()).toBe(false);
    open();
    // Esc with focus on the map, not in the popover.
    fireEvent.keyDown(ground(), { key: 'Escape' });
    expect(isOpen()).toBe(false);
  });

  it('remembers Topo or Aerial in this browser across reloads', async () => {
    localStorage.removeItem(BASEMAP_STORAGE_KEY);
    const { unmount } = await renderSignedIn();
    fireEvent.click(screen.getByRole('button', { name: 'Layers' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Topo' }));
    expect(localStorage.getItem(BASEMAP_STORAGE_KEY)).toBe('topo');
    unmount();
    await renderSignedIn();
    fireEvent.click(screen.getByRole('button', { name: 'Layers' }));
    expect((screen.getByRole('radio', { name: 'Topo' }) as HTMLInputElement).checked).toBe(true);
    // The line is drawn stronger on Topo's light paper.
    expect(plan().classList.contains('plan--light')).toBe(true);
    expect(ground().querySelector('.plan__line-halo')).toBeTruthy();
    localStorage.removeItem(BASEMAP_STORAGE_KEY);
    // Storage that throws (private mode) falls back to Aerial.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(storedBasemap('aerial')).toBe('aerial');
  });
});

describe('auto-hide', () => {
  afterEach(() => vi.useRealTimers());

  it('brings the chrome back 1.5 s after the last move, however long the map kept moving', async () => {
    await renderSignedIn();
    vi.useFakeTimers();
    const { idleMs } = mapChrome.autoHide;
    // A pan, a wheel zoom and another pan, each before the chrome came back.
    fireEvent.keyDown(ground(), { key: 'ArrowLeft' });
    act(() => vi.advanceTimersByTime(idleMs - 200));
    fireEvent.wheel(ground(), { deltaY: -100, clientX: 100, clientY: 100 });
    act(() => vi.advanceTimersByTime(idleMs - 200));
    fireEvent.keyDown(ground(), { key: 'ArrowUp' });
    expect(plan().classList.contains('plan--moving')).toBe(true);
    // Nothing but time since the last move: not back a millisecond early, back right on time.
    act(() => vi.advanceTimersByTime(idleMs - 1));
    expect(plan().classList.contains('plan--moving')).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(plan().classList.contains('plan--moving')).toBe(false);
  });

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
  it('peeks with what the admin acts on, and a Needs you chip that opens the list', async () => {
    phone();
    await renderSignedIn();
    const handle = within(sheet().querySelector('.map-sheet__handle') as HTMLElement);
    await waitFor(() => expect(handle.getByRole('button', { name: /needs? you$/ })).toBeTruthy());
    expect(handle.getByText(/^Overdue at \d{1,2}:\d{2} (AM|PM)$/)).toBeTruthy();
    // The stand and area counts are in the body, not the peek.
    expect(handle.queryByText(/stands/)).toBeNull();
    expect(within(sheet()).getByText('640 acres, 3 stands, 2 areas')).toBeTruthy();
    const chip = handle.getByRole('button', { name: /needs? you$/ });
    const needs = await screen.findByRole('heading', { level: 2, name: /^Needs you/ });
    expect(chip.textContent).toBe(
      `${needs.textContent!.match(/\d+$/)![0]} ${needs.textContent!.endsWith(' 1') ? 'needs' : 'need'} you`,
    );
    fireEvent.click(chip);
    expect(detentOf()).toBe('half');
    expect(document.activeElement).toBe(needs);
  });

  it('moves between peek, half and full; at full it covers the map with its own header', async () => {
    phone();
    await renderSignedIn();
    expect(detentOf()).toBe('peek');
    const more = within(sheet()).getByRole('button', { name: 'Show more' });
    fireEvent.click(more);
    expect(detentOf()).toBe('half');
    expect(plan().classList.contains('plan--covered')).toBe(false);
    fireEvent.click(more);
    expect(detentOf()).toBe('full');
    // The pill, the stack and the footer line hide; the sheet's header names the club.
    expect(plan().classList.contains('plan--covered')).toBe(true);
    for (const piece of ['.map-pill', '.map-stack', '.plan__footer'])
      expect(plan().querySelector(piece)!.classList.contains('map-fade')).toBe(true);
    const header = within(sheet().querySelector('.map-sheet__handle') as HTMLElement);
    expect(header.getByRole('heading', { level: 2, name: 'Oak Ridge Hunt Club' })).toBeTruthy();
    expect(header.queryByRole('button', { name: /needs? you$/ })).toBeNull();
    const less = within(sheet()).getByRole('button', { name: 'Show less' });
    fireEvent.keyDown(less, { key: 'ArrowDown' });
    expect(detentOf()).toBe('half');
    expect(plan().classList.contains('plan--covered')).toBe(false);
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

  it.each(['mouse', 'touch'] as const)(
    'drags down from full with a %s, slowly or with a flick',
    async (pointerType) => {
      phone();
      await renderSignedIn();
      const handle = sheet().querySelector('.map-sheet__handle')!;
      const press = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', y: number, t: number) =>
        fireEvent[type](handle, {
          clientX: 200,
          clientY: y,
          pointerId: 7,
          pointerType,
          timeStamp: t,
        });
      fireEvent.click(within(sheet()).getByRole('button', { name: 'Show more' }));
      fireEvent.click(within(sheet()).getByRole('button', { name: 'Show more' }));
      expect(detentOf()).toBe('full');
      // Full is 88% of 724 (637), its top at 87; a slow drag to 400 leaves 324 px: half (362).
      press('pointerDown', 100, 0);
      press('pointerMove', 250, 500);
      expect(sheet().classList.contains('map-sheet--dragging')).toBe(true);
      press('pointerMove', 400, 1000);
      press('pointerUp', 400, 1000);
      expect(detentOf()).toBe('half');
      // Back to full, then a quick flick down moves one detent.
      fireEvent.click(within(sheet()).getByRole('button', { name: 'Show more' }));
      expect(detentOf()).toBe('full');
      press('pointerDown', 100, 2000);
      press('pointerMove', 160, 2020);
      press('pointerUp', 160, 2020);
      expect(detentOf()).toBe('half');
    },
  );

  it('rises when focus moves into it, so nothing focused is out of sight', async () => {
    phone();
    await renderSignedIn();
    expect(detentOf()).toBe('peek');
    // The "+" menu shows once the club's places have loaded (after the heading): wait for it.
    (await within(sheet()).findByRole('button', { name: ADD_MENU })).focus();
    await waitFor(() => expect(detentOf()).toBe('half'));
  });
});

describe('on a desktop', () => {
  it('keeps the side panel with the conditions in it, and the pill is plain text with the next time', async () => {
    desktop();
    await renderSignedIn();
    const panel = within(screen.getByRole('complementary', { name: 'Club panel' }));
    expect(panel.getByRole('heading', { level: 2, name: 'Today' })).toBeTruthy();
    expect(panel.getByRole('list', { name: 'Conditions today' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Club panel' })).toBeNull();
    // Nothing on the pill is a button: it announces no action it does not have.
    const pill = plan().querySelector('.map-pill')!;
    expect(pill.tagName).toBe('P');
    expect(pill.classList.contains('map-pill--static')).toBe(true);
    expect(pill.querySelector('button, [role], [tabindex]')).toBeNull();
    expect(pill.textContent).not.toContain('Oak Ridge Hunt Club');
    expect(screen.queryByRole('button', { name: /^Today at the property/ })).toBeNull();
  });
});

describe('the panel (and the sheet body)', () => {
  it('heads Stands and areas with one row: the title, Edit property line and one "+" menu', async () => {
    desktop();
    await renderSignedIn();
    const title = await screen.findByRole('heading', { level: 2, name: 'Stands and areas' });
    const head = within(title.parentElement!);
    expect(
      head.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent),
    ).toEqual(['Edit property line', ADD_MENU]);
    fireEvent.click(head.getByRole('button', { name: ADD_MENU }));
    const menu = within(screen.getByRole('group', { name: 'Add to the map' }));
    expect(menu.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Add stand',
      'Add area',
    ]);
    // A row per stand and area: its icon, its name and a chevron.
    const rows = within(screen.getByRole('list', { name: 'Stands and areas' })).getAllByRole(
      'button',
    );
    expect(rows.map((r) => r.textContent)).toEqual([
      'Creek Stand',
      'Big Oak Ladder',
      'Field Blind',
      'North 40',
      'Creek Bottom',
    ]);
    for (const row of rows) expect(row.querySelectorAll('svg')).toHaveLength(2);
    // A stand's row opens its details, as the map does.
    fireEvent.click(rows[1]!);
    expect(await screen.findByRole('dialog', { name: 'Big Oak Ladder' })).toBeTruthy();
  });

  it('folds the map key away under one line, off the map', async () => {
    desktop();
    await renderSignedIn();
    const key = (await screen.findByText('Map key')).closest('details')!;
    expect(key.open).toBe(false);
    expect(key.closest('.plan')).toBeNull();
    expect([...key.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      'Property line',
      'Club area',
      'Stand',
      'Stand you opened',
    ]);
    expect(key.querySelector('.plan__line')).toBeTruthy();
    expect(key.querySelector('.plan__area')).toBeTruthy();
  });
});

describe('stands on the map', () => {
  it('are 32 px markers with a 48 px tap target', async () => {
    await renderSignedIn();
    const stands = screen.getByRole('group', { name: 'Stands' });
    for (const stand of stands.querySelectorAll('.plan__stand')) {
      expect(Number(stand.querySelector('.plan__stand-box')!.getAttribute('width'))).toBe(
        mapChrome.labels.marker,
      );
      expect(Number(stand.querySelector('.plan__stand-hit')!.getAttribute('width'))).toBe(48);
    }
  });
});
