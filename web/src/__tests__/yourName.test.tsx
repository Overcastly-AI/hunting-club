// My club → Your name: a member whose name is only their email's stand-in is asked for the
// name they go by, saved through the club API's member profile update.
import { DISPLAY_NAME_PROBLEMS, DISPLAY_NAME_PURPOSE } from '@huntclub/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { YOUR_NAME } from '../pages/YourName';
import { renderSignedIn } from '../testing/app';
import { sampleData, SIGNED_IN } from '../testing/fakeClubApi';
import { accountButton } from '../testing/shell';

/** Sample data whose signed-in admin (dale@example.com) is still named "dale". */
function standInData() {
  const data = sampleData();
  data.members[0] = { ...data.members[0]!, displayName: 'dale', initials: 'D' };
  return data;
}

const prompt = async () =>
  (await screen.findByRole('heading', { level: 2, name: YOUR_NAME.title })).closest('section')!;

beforeEach(() => localStorage.clear());

describe('Your name', () => {
  it('asks a stand-in for their name, says what it is for, and saves it', async () => {
    const data = standInData();
    await renderSignedIn(data);
    const section = within(await prompt());
    expect(section.getByText(new RegExp(DISPLAY_NAME_PURPOSE))).toBeTruthy();
    expect(section.getByText(/Members see you as “dale”/)).toBeTruthy();

    fireEvent.change(section.getByLabelText(YOUR_NAME.nameLabel), {
      target: { value: '  Dale   Morgan ' },
    });
    expect((section.getByLabelText(YOUR_NAME.initialsLabel) as HTMLInputElement).value).toBe('DM');
    fireEvent.click(section.getByRole('button', { name: YOUR_NAME.save }));

    await waitFor(() =>
      expect(screen.queryByRole('heading', { level: 2, name: YOUR_NAME.title })).toBeNull(),
    );
    const me = data.members.find((m) => m.userId === SIGNED_IN.userId)!;
    expect(me).toMatchObject({ displayName: 'Dale Morgan', initials: 'DM' });
    // The account menu follows the saved name.
    const account = await accountButton();
    await waitFor(() => expect(within(account).getByText('Dale Morgan')).toBeTruthy());
  });

  it('holds the name to the shared rules before calling the API', async () => {
    const data = standInData();
    await renderSignedIn(data);
    const section = within(await prompt());
    fireEvent.change(section.getByLabelText(YOUR_NAME.nameLabel), {
      target: { value: 'dale_morgan' },
    });
    expect(section.getByText(DISPLAY_NAME_PROBLEMS.characters)).toBeTruthy();
    fireEvent.click(section.getByRole('button', { name: YOUR_NAME.save }));
    expect(data.members[0]!.displayName).toBe('dale');
  });

  it('can keep the stand-in, and stays out of the way on this browser after', async () => {
    const data = standInData();
    const view = await renderSignedIn(data);
    const section = within(await prompt());
    fireEvent.click(section.getByRole('button', { name: YOUR_NAME.keep('dale') }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { level: 2, name: YOUR_NAME.title })).toBeNull(),
    );
    expect(data.members[0]!.displayName).toBe('dale');

    view.unmount();
    await renderSignedIn(data);
    await screen.findByRole('heading', { level: 2, name: /^Needs you/ });
    expect(screen.queryByRole('heading', { level: 2, name: YOUR_NAME.title })).toBeNull();
  });

  it('never asks someone who has a name', async () => {
    await renderSignedIn(sampleData());
    await screen.findByRole('heading', { level: 2, name: /^Needs you/ });
    expect(screen.queryByRole('heading', { level: 2, name: YOUR_NAME.title })).toBeNull();
  });
});
