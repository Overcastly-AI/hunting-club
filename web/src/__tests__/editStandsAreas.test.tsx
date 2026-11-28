import {
  AREA_PROBLEMS,
  areaProblem,
  STAND_TYPE_LABELS,
  type Polygon,
  type Stand,
} from '@huntclub/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { AREA_NAME_PROBLEM } from '../map/AreaFields';
import { SAVING } from '../map/MapPill';
import { STAND_PROBLEMS } from '../map/StandEditor';
import { renderSignedIn } from '../testing/app';
import { sampleData, type FakeClubData } from '../testing/fakeClubApi';
import {
  ADD_MENU,
  addToMap,
  drag,
  ground,
  MAP_H,
  MAP_W,
  tap,
  translateOf,
  usePointerEvents,
} from '../testing/mapPointer';

usePointerEvents();

/** My club for the sample club, signed in as its admin, with the club API calls watched. */
async function myClub(data: FakeClubData = sampleData()) {
  const view = await renderSignedIn(data);
  await screen.findByRole('button', { name: ADD_MENU });
  const spy = {
    createStand: vi.spyOn(view.client, 'createStand'),
    updateStand: vi.spyOn(view.client, 'updateStand'),
    deleteStand: vi.spyOn(view.client, 'deleteStand'),
    createArea: vi.spyOn(view.client, 'createArea'),
    updateArea: vi.spyOn(view.client, 'updateArea'),
    deleteArea: vi.spyOn(view.client, 'deleteArea'),
  };
  return { ...view, spy };
}

const standButtons = () => within(screen.getByRole('group', { name: 'Stands' }));
const placing = () => within(screen.getByRole('group', { name: 'Stand being placed' }));
const areaButtons = () => within(screen.getByRole('group', { name: 'Areas' }));
const corners = () => within(screen.getByRole('group', { name: 'Area corners' }));
const nameField = (label: string) => screen.getByRole('textbox', { name: label });

describe('stands on My club (admins)', () => {
  it('places a new stand with a tap, names it, sets its type and saves it through the club API', async () => {
    const { spy } = await myClub();
    addToMap('stand');
    // Not placed yet: Save says where to put it, and nothing is sent.
    fireEvent.change(nameField('Stand name'), { target: { value: 'Fence Row' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect((await screen.findByRole('alert')).textContent).toBe(STAND_PROBLEMS.place);
    tap(400, 300);
    const marker = placing().getByRole('button', { name: /^Fence Row: drag it/ });
    expect(translateOf(marker)).toEqual([400, 300]);
    fireEvent.change(screen.getByRole('combobox', { name: 'Type' }), {
      target: { value: 'ladder' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(spy.createStand).toHaveBeenCalledTimes(1));
    const [, sent] = spy.createStand.mock.calls[0]!;
    expect(sent).toMatchObject({ name: 'Fence Row', type: 'ladder' });
    expect(typeof sent.lat).toBe('number');
    // Saved: the editor closes and the stand is on the map with the others.
    expect(
      await standButtons().findByRole('button', {
        name: `Fence Row, Available, ${STAND_TYPE_LABELS.ladder}`,
      }),
    ).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Stand being placed' })).toBeNull();
  });

  it('shows Saving… with a spinner on a disabled Done while the club service saves, then Stand saved', async () => {
    const { spy, client } = await myClub();
    // The first save waits until `finish`, then goes through to the fake club service.
    let finish = () => undefined as void;
    const held = new Promise<void>((resolve) => (finish = resolve));
    spy.createStand.mockImplementationOnce(async (...args) => {
      await held;
      return client.createStand(...args);
    });
    addToMap('stand');
    fireEvent.change(nameField('Stand name'), { target: { value: 'Fence Row' } });
    tap(400, 300);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    const saving = await screen.findByRole('button', { name: SAVING });
    expect(saving.getAttribute('aria-busy')).toBe('true');
    expect(saving.getAttribute('aria-disabled')).toBe('true');
    expect(saving.querySelector('.ui-spinner')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(true);
    // A second click while it saves sends nothing more.
    fireEvent.click(saving);
    expect(spy.createStand).toHaveBeenCalledTimes(1);
    finish();
    expect(await screen.findByText('Stand saved')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Stand being placed' })).toBeNull();
  });

  it('places a stand from the keyboard, refuses a blank name with the shared rule, and cancels', async () => {
    const { spy } = await myClub();
    addToMap('stand');
    fireEvent.click(screen.getByRole('button', { name: 'Put at the cross' }));
    const marker = placing().getByRole('button', { name: /^New stand: drag it/ });
    expect(translateOf(marker)).toEqual([MAP_W / 2, MAP_H / 2]);
    fireEvent.keyDown(marker, { key: 'ArrowRight', shiftKey: true });
    expect(translateOf(placing().getByRole('button'))[0]).toBeCloseTo(MAP_W / 2 + 40, 0);
    fireEvent.change(nameField('Stand name'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByText(STAND_PROBLEMS.name)).toBeTruthy();
    expect(spy.createStand).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('group', { name: 'Stand being placed' })).toBeNull();
    expect(spy.createStand).not.toHaveBeenCalled();
  });

  it('edits a placed stand from its details: drag to move, rename, and save', async () => {
    const data = sampleData();
    const oak = data.stands.find((s) => s.name === 'Big Oak Ladder')!;
    const { spy } = await myClub(data);
    fireEvent.click(standButtons().getByRole('button', { name: /^Big Oak Ladder,/ }));
    const drawer = await screen.findByRole('dialog', { name: 'Big Oak Ladder' });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Edit stand' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const marker = placing().getByRole('button', { name: /^Big Oak Ladder: drag it/ });
    const [x, y] = translateOf(marker);
    drag(marker, 30, -20);
    const [x2, y2] = translateOf(placing().getByRole('button'));
    expect(x2).toBeCloseTo(x + 30, 0);
    expect(y2).toBeCloseTo(y - 20, 0);
    // The stand being edited is drawn by the editor alone, not also as part of the plan
    // (one level closer, past the zoom where stands show their names).
    fireEvent.keyDown(ground(), { key: '+' });
    const names = [...ground().querySelectorAll('.plan__stand-label')].map((t) => t.textContent);
    expect(names).not.toContain('Big Oak Ladder');
    expect(names).toContain('Creek Stand');
    fireEvent.change(nameField('Stand name'), { target: { value: 'Big Oak' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(spy.updateStand).toHaveBeenCalledTimes(1));
    const [, id, patch] = spy.updateStand.mock.calls[0]!;
    expect(id).toBe(oak.id);
    expect(patch).toMatchObject({ name: 'Big Oak', type: oak.type });
    expect(patch.lon).toBeGreaterThan(oak.lon);
    expect(patch.lat).toBeGreaterThan(oak.lat);
    expect(await standButtons().findByRole('button', { name: /^Big Oak,/ })).toBeTruthy();
  });

  it('deletes a stand only after the confirm step', async () => {
    const data = sampleData();
    const creek = data.stands.find((s) => s.name === 'Creek Stand')!;
    const { spy } = await myClub(data);
    fireEvent.click(standButtons().getByRole('button', { name: /^Creek Stand,/ }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Edit stand' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Delete stand' }));
    const confirm = within(screen.getByRole('group', { name: 'Delete stand' }));
    expect(confirm.getByText('Delete Creek Stand? This cannot be undone.')).toBeTruthy();
    fireEvent.click(confirm.getByRole('button', { name: 'Keep it' }));
    expect(spy.deleteStand).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete stand' }));
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Delete stand' })).getByRole('button', {
        name: 'Delete stand',
      }),
    );
    await waitFor(() => expect(spy.deleteStand).toHaveBeenCalledWith(data.club!.id, creek.id));
    await waitFor(() =>
      expect(standButtons().queryByRole('button', { name: /^Creek Stand,/ })).toBeNull(),
    );
  });
});

describe('areas on My club (admins)', () => {
  it('draws a new area with the polygon tool, names it and saves it through the club API', async () => {
    const { spy } = await myClub();
    addToMap('area');
    tap(300, 300);
    tap(500, 300);
    tap(500, 450);
    fireEvent.click(screen.getByRole('button', { name: 'Close shape' }));
    // A name first (the shared schema's rule), then the shape.
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect((await screen.findByRole('alert')).textContent).toBe(AREA_NAME_PROBLEM);
    fireEvent.change(nameField('Area name'), { target: { value: 'Food Plot' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(spy.createArea).toHaveBeenCalledTimes(1));
    const [, sent] = spy.createArea.mock.calls[0]!;
    expect(sent.name).toBe('Food Plot');
    expect(areaProblem(sent.boundary as Polygon)).toBeNull();
    expect(await areaButtons().findByRole('button', { name: 'Food Plot, area' })).toBeTruthy();
  });

  it('refuses an area that crosses itself, with the shared words, and sends nothing', async () => {
    const { spy } = await myClub();
    addToMap('area');
    fireEvent.change(nameField('Area name'), { target: { value: 'Bow Tie' } });
    tap(300, 300);
    tap(500, 450);
    tap(500, 300);
    tap(300, 450);
    fireEvent.click(screen.getByRole('button', { name: 'Close shape' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect((await screen.findByRole('alert')).textContent).toBe(AREA_PROBLEMS.crosses);
    expect(spy.createArea).not.toHaveBeenCalled();
  });

  it('opens a saved area from its name on the map: redraw, rename, save, and delete after a confirm', async () => {
    const data = sampleData();
    const north = data.areas.find((a) => a.name === 'North 40')!;
    const { spy } = await myClub(data);
    fireEvent.click(areaButtons().getByRole('button', { name: 'North 40, area' }));
    // Its shape, closed, ready to change.
    expect(corners().getAllByRole('button')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: 'Close shape' })).toBeNull();
    fireEvent.keyDown(corners().getByRole('button', { name: /^Corner 2 of 4/ }), {
      key: 'ArrowRight',
      shiftKey: true,
    });
    fireEvent.change(nameField('Area name'), { target: { value: 'North Forty' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(spy.updateArea).toHaveBeenCalledTimes(1));
    const [, id, patch] = spy.updateArea.mock.calls[0]!;
    expect(id).toBe(north.id);
    expect(patch.name).toBe('North Forty');
    expect(patch.boundary).not.toEqual(north.boundary);
    // Delete it.
    fireEvent.click(await areaButtons().findByRole('button', { name: 'North Forty, area' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete area' }));
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Delete area' })).getByRole('button', {
        name: 'Delete area',
      }),
    );
    await waitFor(() => expect(spy.deleteArea).toHaveBeenCalledWith(data.club!.id, north.id));
    await waitFor(() =>
      expect(areaButtons().queryByRole('button', { name: 'North Forty, area' })).toBeNull(),
    );
  });
});

describe('the Stands and areas list (admins)', () => {
  it('opens a saved area for editing from its row, as the map does', async () => {
    await myClub();
    const list = within(screen.getByRole('list', { name: 'Stands and areas' }));
    fireEvent.click(list.getByRole('button', { name: 'Edit Creek Bottom' }));
    expect((nameField('Area name') as HTMLInputElement).value).toBe('Creek Bottom');
    expect(corners().getAllByRole('button')).toHaveLength(5);
    // While one is open, the others wait.
    expect(
      (list.getByRole('button', { name: 'Edit North 40' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('group', { name: 'Area corners' })).toBeNull();
  });
});

describe('a member on My club', () => {
  it('cannot add or edit stands or areas', async () => {
    const data = sampleData();
    data.members[0] = { ...data.members[0]!, role: 'member' };
    data.members[1] = { ...data.members[1]!, role: 'admin' };
    await renderSignedIn(data);
    const stand: Stand = data.stands[0]!;
    fireEvent.click(
      await within(await screen.findByRole('group', { name: 'Stands' })).findByRole('button', {
        name: new RegExp(`^${stand.name},`),
      }),
    );
    const drawer = await screen.findByRole('dialog', { name: stand.name });
    expect(within(drawer).queryByRole('button', { name: 'Edit stand' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add stand' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add area' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Areas' })).toBeNull();
    expect(ground()).toBeTruthy();
  });
});
