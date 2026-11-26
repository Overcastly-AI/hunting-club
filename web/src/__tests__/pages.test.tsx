import { decodeJoinUrl, JOIN_WEB_PATH } from '@huntclub/mesh';
import { WEB_DOMAINS } from '@huntclub/shared';
import { ClubSession, memoryTokenStore, signInCopy } from '@huntclub/shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { adminApi } from '../api/admin';
import { App } from '../App';
import type { WebClubServices } from '../cloud';
import { fakeClubClient, fakeCognitoAuth, sampleData, TEST_CODE } from './fakeClubApi';

async function requestCode() {
  fireEvent.change(screen.getByLabelText(signInCopy.email), {
    target: { value: 'dale@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: signInCopy.sendCode }));
  return screen.findByLabelText(signInCopy.code);
}

async function signIn() {
  fireEvent.change(await requestCode(), { target: { value: TEST_CODE } });
  fireEvent.click(screen.getByRole('button', { name: signInCopy.confirm }));
  await screen.findByRole('navigation', { name: 'Club admin' });
}

function go(hash: string) {
  window.location.hash = hash;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

function renderApp(
  data = sampleData(),
  services: WebClubServices = {
    session: new ClubSession(fakeCognitoAuth(), memoryTokenStore()),
    api: adminApi(fakeClubClient(data)),
  },
) {
  window.location.hash = '';
  return render(<App {...services} />);
}

describe('sign in', () => {
  it('signs in with an email and the emailed code', async () => {
    renderApp();
    await signIn();
    expect(screen.getByText('Signed in as dale@example.com')).toBeTruthy();
  });

  it('explains a wrong code and stays on the code step', async () => {
    renderApp();
    fireEvent.change(await requestCode(), { target: { value: '999999' } });
    fireEvent.click(screen.getByRole('button', { name: signInCopy.confirm }));
    expect((await screen.findByRole('alert')).textContent).toBe(signInCopy.errors.wrong_code);
    expect(screen.getByLabelText(signInCopy.code)).toBeTruthy();
  });

  it('keeps only digits and needs all six', async () => {
    renderApp();
    const input = (await requestCode()) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12a4' } });
    expect(input.value).toBe('124');
    const submit = screen.getByRole('button', { name: signInCopy.confirm }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it('says the club service is not ready when the cloud ids are not set yet', () => {
    renderApp(sampleData(), { session: undefined, api: undefined });
    expect(screen.getByText(/not available yet/)).toBeTruthy();
  });
});

describe('club pages', () => {
  it('shows the club, with every page in the navigation', async () => {
    renderApp();
    await signIn();
    expect(await screen.findByText('Oak Ridge Hunt Club')).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Club admin' });
    for (const label of ['My club', 'Roster', 'Stands and areas', 'Billing']) {
      expect(within(nav).getByRole('link', { name: label })).toBeTruthy();
    }
  });

  it('offers to create a club when there is none', async () => {
    renderApp({ ...sampleData(), club: null });
    await signIn();
    fireEvent.change(await screen.findByLabelText('Club name'), {
      target: { value: 'Pine Hollow' },
    });
    const create = screen.getByRole('button', { name: 'Create club' }) as HTMLButtonElement;
    expect(create.disabled).toBe(true); // your name and initials are needed too
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Pat Lane' } });
    fireEvent.change(screen.getByLabelText('Your initials'), { target: { value: 'pl' } });
    fireEvent.click(create);
    expect(await screen.findByText('Pine Hollow')).toBeTruthy();
  });

  it('lists the roster and makes an invite QR carrying a club join link', async () => {
    renderApp();
    await signIn();
    go('#/roster');
    expect(await screen.findByText('Ruth Keller')).toBeTruthy();
    expect(screen.getByText('Guest')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Make an invite' }));
    expect(await screen.findByRole('img', { name: 'Club invite QR code' })).toBeTruthy();
    const link = screen.getByTestId('invite-link').textContent!;
    expect(link.startsWith(`https://${WEB_DOMAINS.dev}${JOIN_WEB_PATH}#`)).toBe(true);
    expect(decodeJoinUrl(link).target).toMatchObject({
      kind: 'club',
      clubId: sampleData().club!.id,
    });
  });

  it('lists stands with plain-language types, and areas', async () => {
    renderApp();
    await signIn();
    go('#/stands');
    expect(await screen.findByText('Big Oak Ladder')).toBeTruthy();
    expect(screen.getByText('Tree stand')).toBeTruthy();
    expect(screen.getAllByText('North 40').length).toBeGreaterThan(0);
  });

  it('shows billing status and paid-through date', async () => {
    renderApp();
    await signIn();
    go('#/billing');
    expect(await screen.findByText('Active')).toBeTruthy();
    expect(screen.getByText('August 1, 2027')).toBeTruthy();
  });
});
