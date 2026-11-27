import {
  coordinatesReadout,
  HARVEST_SEX_LABELS,
  STAND_STATUS_LABELS,
  STAND_TYPE_LABELS,
  type Stand,
} from '@huntclub/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { formatLocalDay } from '../format';
import { STAND_HARVESTS_EMPTY, STAND_HARVESTS_UNKNOWN } from '../map/StandDrawer';
import { renderSignedIn } from '../testing/app';
import { sampleData, type FakeClubData } from '../testing/fakeClubApi';

/** A sample stand by name, from the shared sample property. */
const sampleStand = (data: FakeClubData, name: string) => data.stands.find((s) => s.name === name)!;

/** What a stand's marker is called: its plate's words (name, status), then its type. */
const markerName = (stand: Stand) =>
  `${stand.name}, ${STAND_STATUS_LABELS[stand.active ? 'open' : 'closed']}, ${STAND_TYPE_LABELS[stand.type]}`;

/** My club, signed in over `data`, with the stand's marker found on the map. */
async function openMyClub(data: FakeClubData, stand: Stand) {
  const view = await renderSignedIn(data);
  const stands = await screen.findByRole('group', { name: 'Stands' });
  const marker = await within(stands).findByRole('button', { name: markerName(stand) });
  return { ...view, marker };
}

/** The open drawer's facts as "Label: value" (the spoken coordinates, not the shown ones). */
const facts = (drawer: HTMLElement) =>
  [...drawer.querySelectorAll('.stand-facts__row')].map(
    (row) =>
      `${row.querySelector('dt')!.textContent}: ${row.querySelector('dd')!.textContent!.trim()}`,
  );

const closed = () => waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

describe('stand details on the club map', () => {
  it("opens from a stand's marker with its name, type, status, area and place, and closes with the close button", async () => {
    const data = sampleData();
    const stand = sampleStand(data, 'Big Oak Ladder');
    const { marker } = await openMyClub(data, stand);
    expect(marker.getAttribute('aria-haspopup')).toBe('dialog');
    expect(screen.queryByRole('dialog')).toBeNull();

    marker.focus();
    fireEvent.click(marker);
    const drawer = await screen.findByRole('dialog', { name: stand.name });
    expect(drawer.classList.contains('ui-dialog--side')).toBe(true);
    expect(within(drawer).getByText('In North 40')).toBeTruthy();
    const place = coordinatesReadout(stand.lat, stand.lon);
    expect(facts(drawer)).toEqual([
      `Type: ${STAND_TYPE_LABELS.ladder}`,
      `Check-in: ${STAND_STATUS_LABELS.open}`,
      `Coordinates: ${place.short}${place.spoken}`,
    ]);
    // The open stand is the selected item on the map.
    expect(marker.classList.contains('plan__stand--selected')).toBe(true);

    fireEvent.click(within(drawer).getByRole('button', { name: 'Close' }));
    await closed();
    expect(document.activeElement).toBe(marker);
    expect(marker.classList.contains('plan__stand--selected')).toBe(false);
  });

  it('opens with Enter or Space, closes with Esc, and gives focus back to the marker', async () => {
    const data = sampleData();
    const stand = sampleStand(data, 'Creek Stand');
    const { marker } = await openMyClub(data, stand);
    expect(marker.getAttribute('tabindex')).toBe('0');

    for (const key of ['Enter', ' ']) {
      marker.focus();
      fireEvent.keyDown(marker, { key });
      const drawer = await screen.findByRole('dialog', { name: stand.name });
      expect(drawer.contains(document.activeElement)).toBe(true);
      // Esc on a modal <dialog> is its cancel event (jsdom does not turn the key into it).
      fireEvent(drawer, new Event('cancel', { cancelable: true }));
      await closed();
      expect(document.activeElement).toBe(marker);
    }
    // Other keys do nothing.
    fireEvent.keyDown(marker, { key: 'a' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('says a closed stand is closed, and shows its notes when it has them', async () => {
    const data = sampleData();
    const stand = sampleStand(data, 'Field Blind');
    stand.notes = 'Faces the bean field.\nPark at the north gate.';
    const { marker } = await openMyClub(data, stand);
    fireEvent.click(marker);
    const drawer = await screen.findByRole('dialog', { name: stand.name });
    expect(facts(drawer).slice(0, 3)).toEqual([
      `Type: ${STAND_TYPE_LABELS.ground_blind}`,
      `Check-in: ${STAND_STATUS_LABELS.closed}`,
      `Notes: ${stand.notes}`,
    ]);
  });

  it("lists the stand's harvests shared with the club, and says when there are none", async () => {
    const data = sampleData();
    const oak = sampleStand(data, 'Big Oak Ladder');
    const creek = sampleStand(data, 'Creek Stand');
    // A private harvest at the stand is never listed.
    const shared = data.harvests.find((h) => h.standId === oak.id)!;
    data.harvests.push({ ...shared, id: crypto.randomUUID(), species: 'Hidden', shared: false });
    const { marker } = await openMyClub(data, oak);
    fireEvent.click(marker);
    const drawer = await screen.findByRole('dialog', { name: oak.name });
    const list = within(drawer).getByRole('region', { name: 'Recent harvests' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual([
      `${shared.species}${formatLocalDay(shared.harvestedAt)}, Dale Morgan${HARVEST_SEX_LABELS[shared.sex]}`,
    ]);
    expect(within(list).getByRole('link', { name: 'All harvests' }).getAttribute('href')).toBe(
      '#/harvests',
    );
    fireEvent(drawer, new Event('cancel', { cancelable: true }));
    await closed();

    fireEvent.click(screen.getByRole('button', { name: markerName(creek) }));
    const empty = await screen.findByRole('dialog', { name: creek.name });
    expect(within(empty).getByText(STAND_HARVESTS_EMPTY)).toBeTruthy();
  });

  it('says when harvests could not be loaded, and offers no way to edit the stand', async () => {
    const data = sampleData();
    const stand = sampleStand(data, 'Creek Stand');
    // The harvests list fails (offline); the stands still open.
    Object.defineProperty(data, 'harvests', {
      get: () => {
        throw new Error('offline');
      },
    });
    const { marker } = await openMyClub(data, stand);
    fireEvent.click(marker);
    const drawer = await screen.findByRole('dialog', { name: stand.name });
    expect(within(drawer).getByText(STAND_HARVESTS_UNKNOWN)).toBeTruthy();
    // Read-only: the only control is Close, the only link is to the harvests page.
    expect(
      within(drawer)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label') ?? b.textContent),
    ).toEqual(['Close']);
    expect(
      within(drawer)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['All harvests']);
  });
});
