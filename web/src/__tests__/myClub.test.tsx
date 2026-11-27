import { DAY_MS, polygonBounds, READOUT_LABELS, type MapPack, type Member } from '@huntclub/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { OVERDUE_ALERT_LABEL } from '../components/ConditionsStrip';
import { SAMPLE_PROPERTY } from '../map/sampleProperty';
import { MAP_EMPTY, NEEDS_YOU_EMPTY, OUT_NOW_EMPTY } from '../pages/MyClub';
import { renderSignedIn } from '../testing/app';
import { sampleData } from '../testing/fakeClubApi';
import { packArchive, packFetch } from '../testing/packArchive';

const iso = (ms: number) => new Date(ms).toISOString();

/** The Needs you list's rows: title, detail and where its button goes ("In the app" if none). */
async function needsYou() {
  const section = (await screen.findByRole('heading', { level: 2, name: /^Needs you/ })).closest(
    'section',
  )!;
  return within(section)
    .queryAllByRole('listitem')
    .map((row) => ({
      text: row.querySelector('.row-item__text')!.textContent,
      to:
        row.querySelector('a')?.getAttribute('href') ?? row.textContent!.match(/In the app$/)?.[0],
    }));
}

/** The conditions strip's cells as "Label value". */
const strip = () =>
  within(screen.getByRole('list', { name: 'Conditions today' }))
    .getAllByRole('listitem')
    .map((cell) => cell.textContent);

describe('My club', () => {
  it('lists what needs the admin, most urgent first, each with the page that deals with it', async () => {
    const data = sampleData();
    const now = Date.now();
    const guest: Member = { ...data.members[2]!, expiresAt: iso(now + 3 * DAY_MS) };
    data.members = [data.members[0]!, data.members[1]!, guest];
    data.subscription = {
      ...data.subscription!,
      status: 'trialing',
      paidThrough: iso(now + 2 * DAY_MS),
    };
    data.invites.push({
      id: '7b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d01',
      clubId: data.club!.id,
      token: '0f'.repeat(16),
      role: 'member',
      uses: 0,
      expiresAt: iso(now + 10 * DAY_MS),
      createdAt: iso(now),
      updatedAt: iso(now),
    });
    await renderSignedIn(data);
    expect(await needsYou()).toEqual([
      { text: 'The free trial ends in 2 daysBilling starts then.', to: '#/billing' },
      { text: 'A map pack did not buildUSGS did not answer', to: '#/maps' },
      { text: 'A guest pass ends in 3 daysSam Ortiz', to: '#/roster' },
      { text: '1 invite not used yetNobody has joined with them.', to: '#/roster' },
    ]);
    expect(screen.getByRole('heading', { level: 2, name: 'Needs you 4' })).toBeTruthy();
  });

  it('says the property line is drawn in the app, and that nothing else needs the admin', async () => {
    const data = sampleData();
    const { boundary: _none, ...club } = data.club!;
    await renderSignedIn({ ...data, club, areas: [], stands: [] });
    expect(await needsYou()).toEqual([
      { text: expect.stringMatching(/^Draw your property line/), to: 'In the app' },
    ]);
    // The empty map uses the EmptyState pattern: an icon, a title and one line, on a plate.
    const map = screen
      .getByRole('heading', { level: 3, name: MAP_EMPTY.title })
      .closest('.plan__empty')!;
    expect(map.querySelector('.ui-empty__icon svg')).toBeTruthy();
    expect(within(map as HTMLElement).getByText(MAP_EMPTY.line)).toBeTruthy();
  });

  it('shows nothing to do when nothing needs the admin', async () => {
    const data = sampleData();
    await renderSignedIn({ ...data, mapPacks: data.mapPacks.filter((p) => p.status === 'ready') });
    const empty = await screen.findByRole('heading', { level: 3, name: NEEDS_YOU_EMPTY.title });
    expect(empty.closest('.ui-empty')!.querySelector('.ui-empty__icon svg')).toBeTruthy();
    expect(screen.getByText(NEEDS_YOU_EMPTY.line)).toBeTruthy();
    expect(await needsYou()).toEqual([]);
  });

  it('reads out sunrise, sunset and the overdue alert time at the property, never shooting hours, and no wind or temperature', async () => {
    await renderSignedIn();
    await screen.findByRole('heading', { level: 1, name: 'Oak Ridge Hunt Club' });
    const cells = strip();
    expect(cells.map((c) => c!.replace(/\d.*$/, ''))).toEqual([
      READOUT_LABELS.sunrise,
      READOUT_LABELS.sunset,
      OVERDUE_ALERT_LABEL,
    ]);
    for (const cell of cells) expect(cell).toMatch(/\d{1,2}:\d{2} (AM|PM)$/);
    // The alert is sunset plus the club's grace (30 minutes).
    const minutes = (cell: string) => {
      const [, h, m, ampm] = cell.match(/(\d{1,2}):(\d{2}) (AM|PM)$/)!;
      return ((Number(h) % 12) + (ampm === 'PM' ? 12 : 0)) * 60 + Number(m);
    };
    expect(minutes(cells[2]!) - minutes(cells[1]!)).toBe(30);
    expect(document.body.textContent).not.toMatch(
      new RegExp(`${READOUT_LABELS.wind}|${READOUT_LABELS.temperature}`),
    );
    await waitFor(() =>
      expect(
        screen.getByText(/overdue alert goes to the club .* at sunset plus 30 minutes\./),
      ).toBeTruthy(),
    );
    expect(document.body.textContent).not.toMatch(/shooting|first light|last light/i);
  });

  it('says live positions are in the app, never a blank or made-up Out now list', async () => {
    await renderSignedIn();
    const section = (await screen.findByRole('heading', { level: 2, name: 'Out now' })).closest(
      'section',
    )!;
    expect(
      within(section).getByRole('heading', { level: 3, name: OUT_NOW_EMPTY.title }),
    ).toBeTruthy();
    expect(within(section).getByText(OUT_NOW_EMPTY.line)).toBeTruthy();
    expect(section.querySelector('.ui-empty__icon svg')).toBeTruthy();
    expect(within(section).queryByRole('listitem')).toBeNull();
  });

  it("draws the club's ready map pack under the plan, read from its own origin", async () => {
    const data = sampleData();
    const pack = data.mapPacks.find(
      (p): p is Extract<MapPack, { status: 'ready' }> => p.status === 'ready',
    )!;
    const fetch = packFetch(pack, packArchive(polygonBounds(SAMPLE_PROPERTY.boundary)));
    vi.stubGlobal('fetch', fetch);
    try {
      await renderSignedIn(data);
      const map = await screen.findByRole('img', { name: /^Map of Oak Ridge Hunt Club/ });
      await waitFor(() =>
        expect(map.querySelectorAll('.plan__basemap image').length).toBeGreaterThan(0),
      );
      expect(map.querySelector('.plan__credit')!.textContent).toBe('USGS The National Map');
      for (const [url] of fetch.mock.calls) expect(url).toBe(`/${pack.s3Key}`);
      for (const image of map.querySelectorAll('image')) {
        expect(image.getAttribute('href')).toMatch(/^data:image\/jpeg;base64,/);
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('draws the plan alone when the pack cannot be read (offline)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    );
    try {
      await renderSignedIn();
      const map = await screen.findByRole('img', { name: /^Map of Oak Ridge Hunt Club/ });
      await waitFor(() => expect(map.querySelectorAll('.plan__stand')).toHaveLength(3));
      expect(map.querySelector('.plan__grid')).toBeTruthy();
      expect(map.querySelectorAll('image')).toHaveLength(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('draws the property line, areas and stands, and names the club and what it holds', async () => {
    await renderSignedIn();
    const map = await screen.findByRole('img', { name: /^Map of Oak Ridge Hunt Club/ });
    expect(map.getAttribute('aria-label')).toBe(
      'Map of Oak Ridge Hunt Club: the property line, 2 areas and 3 stands.',
    );
    await waitFor(() => expect(map.querySelectorAll('.plan__stand')).toHaveLength(3));
    expect(map.querySelectorAll('.plan__area')).toHaveLength(2);
    expect(map.querySelectorAll('.plan__line')).toHaveLength(1);
    expect(screen.getByText('640 acres, 3 stands, 2 areas')).toBeTruthy();
    // No positions: nobody's location reaches the club service.
    expect(map.querySelectorAll('.plan__hunter, circle')).toHaveLength(0);
  });
});
