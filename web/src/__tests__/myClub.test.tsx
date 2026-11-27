import { DAY_MS, READOUT_LABELS, UNKNOWN_VALUE, type Member } from '@huntclub/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { renderSignedIn } from '../testing/app';
import { sampleData } from '../testing/fakeClubApi';

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
    expect(screen.getByText(/No property line, areas or stands yet/)).toBeTruthy();
  });

  it('shows nothing to do when nothing needs the admin', async () => {
    const data = sampleData();
    await renderSignedIn({ ...data, mapPacks: data.mapPacks.filter((p) => p.status === 'ready') });
    expect(await screen.findByText('Nothing needs you right now.')).toBeTruthy();
    expect(await needsYou()).toEqual([]);
  });

  it('reads out sunrise and sunset at the property, never shooting hours; wind and temperature are not known here', async () => {
    await renderSignedIn();
    await screen.findByRole('heading', { level: 1, name: 'Oak Ridge Hunt Club' });
    const cells = strip();
    expect(cells.map((c) => c!.replace(/\d.*$/, '').replace(UNKNOWN_VALUE, ''))).toEqual([
      READOUT_LABELS.sunrise,
      READOUT_LABELS.sunset,
      `${READOUT_LABELS.wind}not known`,
      `${READOUT_LABELS.temperature}not known`,
    ]);
    expect(cells[0]).toMatch(/\d{1,2}:\d{2} (AM|PM)/);
    expect(cells[1]).toMatch(/\d{1,2}:\d{2} (AM|PM)/);
    await waitFor(() =>
      expect(
        screen.getByText(/the club gets an overdue alert\. That is sunset plus 30 minutes\./),
      ).toBeTruthy(),
    );
    expect(document.body.textContent).not.toMatch(/shooting|first light|last light/i);
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
    expect(screen.queryByText(/Out now/)).toBeNull();
  });
});
